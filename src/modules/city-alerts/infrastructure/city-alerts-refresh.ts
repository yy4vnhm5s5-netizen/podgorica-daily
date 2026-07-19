import { env } from "@/config/env";
import { runCedisCollector } from "./collect-cedis.ts";
import { runVikpgCollector } from "./collect-vikpg.ts";
import {
  runCityAlertsRefresh,
  type CityAlertsRefreshProvider,
  type CityAlertsRefreshSummary,
} from "./city-alerts-refresh-runner.ts";

async function refreshCityAlerts({
  log = console.info,
  providers = defaultProviders(),
  trigger = "endpoint",
}: {
  log?: (message: string) => void;
  providers?: readonly CityAlertsRefreshProvider[];
  trigger?: "endpoint";
} = {}): Promise<CityAlertsRefreshSummary> {
  const startedAt = Date.now();
  log(JSON.stringify({ event: "city-alerts-refresh-started", trigger }));
  const summary = await runCityAlertsRefresh({ providers });
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

function defaultProviders(): CityAlertsRefreshProvider[] {
  return [
    ...(env.ENABLE_CEDIS && env.CEDIS_PROVIDER_MODE === "live"
      ? [{ id: "cedis" as const, refresh: () => runCedisCollector({ cachePath: env.CEDIS_CACHE_PATH }) }]
      : []),
    ...(env.ENABLE_VIKPG && env.VIKPG_PROVIDER_MODE === "live"
      ? [{ id: "vikpg" as const, refresh: () => runVikpgCollector({ cachePath: env.VIKPG_CACHE_PATH }) }]
      : []),
  ];
}

export {
  refreshCityAlerts,
};
