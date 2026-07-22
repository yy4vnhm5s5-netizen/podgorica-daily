import type { CityAlertCollectorResult } from "@/modules/city-alerts/infrastructure/city-alerts-collector";
import type { EventRefreshSummary } from "@/modules/events/infrastructure/events-refresh-runner";
import type { PodgoricaFlightsCollectorResult } from "@/modules/flights/infrastructure/collect-podgorica-flights";
import type { GoingOutCollectorResult } from "@/modules/going-out/infrastructure/collect-montegigs-going-out";
import type { ZpcgCollectorResult } from "@/modules/transport/infrastructure/collect-zpcg-railway";
import type { RefreshEndpointState } from "./refresh-post-handler";

interface ProviderRefreshEndpointResult {
  acceptedCount: number;
  errorCode?: string;
  provider: string;
  retainedPreviousSnapshot: boolean;
  state: RefreshEndpointState;
  warnings: readonly string[];
}

interface EventRefreshEndpointResult {
  providers: readonly {
    acceptedCount: number;
    id: string;
    retainedPreviousSnapshot: boolean;
    state: "failed" | "retained" | "success";
  }[];
  providerGroup: "cineplexx" | "standard-events";
  state: RefreshEndpointState;
}

function toCityAlertRefreshEndpointResult(
  provider: "cedis" | "vikpg",
  result: CityAlertCollectorResult,
): ProviderRefreshEndpointResult {
  const { summary } = result;
  return {
    acceptedCount: summary.alertCount,
    ...(summary.errorCode ? { errorCode: summary.errorCode } : {}),
    provider,
    retainedPreviousSnapshot: summary.retainedPreviousSnapshot,
    state: summary.status,
    warnings: summary.warnings,
  };
}

function toFlightsRefreshEndpointResult(
  result: PodgoricaFlightsCollectorResult,
): ProviderRefreshEndpointResult {
  return toSingleProviderRefreshEndpointResult(
    "podgorica-flights",
    result,
    (refresh) => refresh.acceptedFlights,
  );
}

function toGoingOutRefreshEndpointResult(
  result: GoingOutCollectorResult,
): ProviderRefreshEndpointResult {
  return toSingleProviderRefreshEndpointResult(
    "montegigs-going-out",
    result,
    (refresh) => refresh.acceptedEvents,
  );
}

function toZpcgRefreshEndpointResult(result: ZpcgCollectorResult): ProviderRefreshEndpointResult {
  return toSingleProviderRefreshEndpointResult(
    "zpcg-railway",
    result,
    (refresh) => refresh.acceptedDepartures,
  );
}

function toSingleProviderRefreshEndpointResult<
  TRefresh extends {
    errorCode?: string;
    retainedPreviousSnapshot: boolean;
    success: boolean;
    warnings: readonly string[];
  },
>(
  provider: string,
  result: {
    refresh: TRefresh | null;
    state: "already-running" | "failed" | "success";
  },
  getAcceptedCount: (refresh: TRefresh) => number,
): ProviderRefreshEndpointResult {
  if (result.state === "already-running") {
    return {
      acceptedCount: 0,
      provider,
      retainedPreviousSnapshot: false,
      state: "already-running",
      warnings: [],
    };
  }

  const refresh = result.refresh;
  if (!refresh) {
    return {
      acceptedCount: 0,
      provider,
      retainedPreviousSnapshot: false,
      state: "unavailable",
      warnings: [],
    };
  }

  return {
    acceptedCount: getAcceptedCount(refresh),
    ...(refresh.errorCode ? { errorCode: refresh.errorCode } : {}),
    provider,
    retainedPreviousSnapshot: refresh.retainedPreviousSnapshot,
    state: refresh.success
      ? "success"
      : refresh.retainedPreviousSnapshot
        ? "retained"
        : "unavailable",
    warnings: refresh.warnings,
  };
}

function toEventRefreshEndpointResult(
  providerGroup: "cineplexx" | "standard-events",
  summary: EventRefreshSummary,
): EventRefreshEndpointResult {
  return {
    providers: summary.providers.map(({ acceptedCount, id, retainedPreviousSnapshot, state }) => ({
      acceptedCount,
      id,
      retainedPreviousSnapshot,
      state,
    })),
    providerGroup,
    state:
      summary.state === "failure"
        ? "unavailable"
        : summary.state === "partial"
          ? "partial"
          : summary.providers.some((provider) => provider.state === "retained")
            ? "retained"
            : summary.state,
  };
}

export {
  toCityAlertRefreshEndpointResult,
  toEventRefreshEndpointResult,
  toFlightsRefreshEndpointResult,
  toGoingOutRefreshEndpointResult,
  toZpcgRefreshEndpointResult,
  type EventRefreshEndpointResult,
  type ProviderRefreshEndpointResult,
};
