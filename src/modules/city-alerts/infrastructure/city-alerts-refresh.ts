import { env } from "../../../config/env.ts";
import { getCity } from "@/shared/config/cities";
import {
  runActiveCedisCollectors,
  type CollectorResult as CedisCollectorResult,
} from "./collect-cedis.ts";
import { runVikpgCollector } from "./collect-vikpg.ts";
import { runVodovodKotorCollector } from "./vodovod-kotor.ts";
import {
  runCityAlertsRefresh,
  type CityAlertsRefreshProvider,
  type CityAlertsRefreshSummary,
} from "./city-alerts-refresh-runner.ts";

async function refreshCityAlerts({
  cedisCollectors = runActiveCedisCollectors,
  log = console.info,
  providers,
  trigger = "endpoint",
}: {
  cedisCollectors?: () => Promise<readonly CedisCollectorResult[]>;
  log?: (message: string) => void;
  providers?: readonly CityAlertsRefreshProvider[];
  trigger?: "endpoint";
} = {}): Promise<CityAlertsRefreshSummary> {
  const resolvedProviders = providers ?? defaultProviders({ cedisCollectors });
  const startedAt = Date.now();
  log(JSON.stringify({ event: "city-alerts-refresh-started", trigger }));
  const summary = await runCityAlertsRefresh({ providers: resolvedProviders });
  log(
    JSON.stringify({
      durationMs: Date.now() - startedAt,
      event: "city-alerts-refresh-completed",
      providers: summary.providers,
      state: summary.state,
      trigger,
    }),
  );
  return summary;
}

function defaultProviders({
  cedisCollectors = runActiveCedisCollectors,
}: {
  cedisCollectors?: () => Promise<readonly CedisCollectorResult[]>;
} = {}): CityAlertsRefreshProvider[] {
  return [
    ...(env.ENABLE_CEDIS && env.CEDIS_PROVIDER_MODE === "live"
      ? [
          {
            id: "cedis" as const,
            refresh: () => refreshActiveCedisCities(cedisCollectors),
          },
        ]
      : []),
    ...(env.ENABLE_VIKPG && env.VIKPG_PROVIDER_MODE === "live"
      ? [
          {
            id: "vikpg" as const,
            refresh: () => runVikpgCollector({ cachePath: env.VIKPG_CACHE_PATH }),
          },
        ]
      : []),
    ...(env.ENABLE_VODOVOD_KOTOR && getCity("kotor")?.isActive
      ? [
          {
            id: "vodovod-kotor" as const,
            refresh: () => runVodovodKotorCollector(),
          },
        ]
      : []),
  ];
}

async function refreshActiveCedisCities(
  cedisCollectors: () => Promise<readonly CedisCollectorResult[]>,
) {
  const results = await cedisCollectors();
  const summaries = results.map(({ summary }) => summary);
  const usable = summaries.filter(({ status }) => status !== "unavailable");
  const allSuccessful =
    summaries.length > 0 && summaries.every(({ status }) => status === "success");
  const allAlreadyRunning =
    summaries.length > 0 && summaries.every(({ status }) => status === "already-running");
  const retainedPreviousSnapshot = summaries.some(
    ({ retainedPreviousSnapshot }) => retainedPreviousSnapshot,
  );
  const unavailable = summaries.filter(({ status }) => status === "unavailable");

  return {
    exitCode: usable.length > 0 ? 0 : 1,
    summary: {
      alertCount: summaries.reduce((count, summary) => count + summary.alertCount, 0),
      cacheStatus:
        allSuccessful || usable.some(({ status }) => status === "success")
          ? "fresh"
          : retainedPreviousSnapshot
            ? "stale"
            : "unavailable",
      ...(unavailable[0]?.errorCode ? { errorCode: unavailable[0].errorCode } : {}),
      retainedPreviousSnapshot,
      status: allAlreadyRunning
        ? "already-running"
        : allSuccessful
          ? "success"
          : usable.length > 0
            ? "retained"
            : "unavailable",
      warnings: [
        ...summaries.flatMap(({ cityId, warnings }) =>
          warnings.map((warning) => `${cityId ?? "unknown"}:${warning}`),
        ),
        ...(unavailable.length > 0 ? ["one-or-more-city-refreshes-unavailable"] : []),
      ],
    },
  } satisfies Awaited<ReturnType<CityAlertsRefreshProvider["refresh"]>>;
}

export { defaultProviders, refreshActiveCedisCities, refreshCityAlerts };
