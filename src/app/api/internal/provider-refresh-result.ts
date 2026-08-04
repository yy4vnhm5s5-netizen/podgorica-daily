import type { CityAlertCollectorResult } from "@/modules/city-alerts/infrastructure/city-alerts-collector";
import type { EventRefreshSummary } from "@/modules/events/infrastructure/events-refresh-runner";
import type { PodgoricaFlightsCollectorResult } from "@/modules/flights/infrastructure/collect-podgorica-flights";
import type { GoingOutCollectorResult } from "@/modules/going-out/infrastructure/collect-montegigs-going-out";
import type { BudvaSeaWaterQualityCollectorResult } from "@/modules/sea-water-quality/infrastructure/collect-budva-sea-water-quality";
import type { ZpcgCollectorResult } from "@/modules/transport/infrastructure/collect-zpcg-railway";
import type { VikUlcinjCollectorResult } from "@/modules/city-alerts/infrastructure/vik-ulcinj";
import type { VodovodKotorCollectorResult } from "@/modules/city-alerts/infrastructure/vodovod-kotor";
import type { WeatherCollectorResult } from "@/modules/weather/infrastructure/collect-weather";
import type { RefreshEndpointState } from "./refresh-post-handler";
import { isPodgoricaFlightsUpstreamErrorCode } from "@/modules/flights/infrastructure/podgorica-flights";

interface ProviderRefreshEndpointResult {
  acceptedCount: number;
  cityId?: string;
  errorCode?: string;
  provider: string;
  retainedPreviousSnapshot: boolean;
  snapshotState?: "fresh" | "not-run" | "stale" | "unavailable";
  state: RefreshEndpointState;
  warnings: readonly string[];
}

interface MultiCityAlertRefreshEndpointResult {
  cities: readonly ProviderRefreshEndpointResult[];
  provider: "cedis";
  state: RefreshEndpointState;
}

interface MultiCityFlightsRefreshEndpointResult {
  cities: readonly ProviderRefreshEndpointResult[];
  provider: "podgorica-flights";
  state: RefreshEndpointState;
}

interface MultiCityGoingOutRefreshEndpointResult {
  cities: readonly ProviderRefreshEndpointResult[];
  provider: "montegigs-going-out";
  state: RefreshEndpointState;
}

interface MultiCitySeaWaterQualityRefreshEndpointResult {
  cities: readonly ProviderRefreshEndpointResult[];
  provider: "sea-water-quality";
  state: RefreshEndpointState;
}

interface MultiCityWeatherRefreshEndpointResult {
  cities: readonly ProviderRefreshEndpointResult[];
  provider: "weather";
  state: RefreshEndpointState;
}

function aggregateMultiCityRefreshState(cities: readonly ProviderRefreshEndpointResult[]) {
  const states = cities.map(({ state }) => state);
  if (states.some((state) => state === "operational-failure")) return "operational-failure";
  if (states.every((state) => state === "success")) return "success";
  if (states.every((state) => state === "already-running")) return "already-running";
  if (states.every((state) => state === "unavailable")) return "unavailable";
  if (states.every((state) => state === "upstream-unavailable")) return "upstream-unavailable";
  if (states.some((state) => state === "unavailable" || state === "upstream-unavailable")) {
    return "partial";
  }
  return "retained";
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
  provider: "cedis" | "vik-ulcinj" | "vikpg" | "vodovod-kotor",
  result: CityAlertCollectorResult,
): ProviderRefreshEndpointResult {
  const { summary } = result;
  return {
    acceptedCount: summary.alertCount,
    ...(summary.cityId ? { cityId: summary.cityId } : {}),
    ...(summary.errorCode ? { errorCode: summary.errorCode } : {}),
    provider,
    retainedPreviousSnapshot: summary.retainedPreviousSnapshot,
    state: summary.status,
    warnings: summary.warnings,
  };
}

function toVikUlcinjRefreshEndpointResult(
  result: VikUlcinjCollectorResult,
): ProviderRefreshEndpointResult {
  return toCityAlertRefreshEndpointResult("vik-ulcinj", result);
}

function toVodovodKotorRefreshEndpointResult(
  result: VodovodKotorCollectorResult,
): ProviderRefreshEndpointResult {
  return toCityAlertRefreshEndpointResult("vodovod-kotor", result);
}

function toMultiCityAlertRefreshEndpointResult(
  provider: "cedis",
  results: readonly CityAlertCollectorResult[],
): MultiCityAlertRefreshEndpointResult {
  const cities = results.map((result) => toCityAlertRefreshEndpointResult(provider, result));
  const states = cities.map(({ state }) => state);

  return {
    cities,
    provider,
    state: states.every((state) => state === "success")
      ? "success"
      : states.every((state) => state === "already-running")
        ? "already-running"
        : states.every((state) => state === "unavailable")
          ? "unavailable"
          : states.some((state) => state === "unavailable")
            ? "partial"
            : "retained",
  };
}

function toFlightsRefreshEndpointResult(
  result: PodgoricaFlightsCollectorResult,
): ProviderRefreshEndpointResult {
  const endpointResult = toSingleProviderRefreshEndpointResult(
    "podgorica-flights",
    result,
    (refresh) => refresh.acceptedFlights,
    result.cityId,
  );

  if (endpointResult.state !== "unavailable" && endpointResult.state !== "retained") {
    return endpointResult;
  }
  if (!endpointResult.errorCode) return endpointResult;

  // The upstream-vs-operational classification is owned by podgorica-flights.ts (the module that
  // actually produces these error codes), not duplicated here as a separate list that could drift
  // out of sync with it.
  if (!isPodgoricaFlightsUpstreamErrorCode(endpointResult.errorCode)) {
    return { ...endpointResult, state: "operational-failure" };
  }
  if (endpointResult.state === "unavailable") {
    return { ...endpointResult, state: "upstream-unavailable" };
  }
  return endpointResult;
}

function toMultiCityFlightsRefreshEndpointResult(
  results: readonly PodgoricaFlightsCollectorResult[],
): MultiCityFlightsRefreshEndpointResult {
  const cities = results.map((result) => toFlightsRefreshEndpointResult(result));

  return {
    cities,
    provider: "podgorica-flights",
    state: aggregateMultiCityRefreshState(cities),
  };
}

function toGoingOutRefreshEndpointResult(
  result: GoingOutCollectorResult,
): ProviderRefreshEndpointResult {
  return toSingleProviderRefreshEndpointResult(
    "montegigs-going-out",
    result,
    (refresh) => refresh.acceptedEvents,
    result.cityId,
  );
}

function toMultiCityGoingOutRefreshEndpointResult(
  results: readonly GoingOutCollectorResult[],
): MultiCityGoingOutRefreshEndpointResult {
  const cities = results.map((result) => toGoingOutRefreshEndpointResult(result));

  return {
    cities,
    provider: "montegigs-going-out",
    state: aggregateMultiCityRefreshState(cities),
  };
}

function toZpcgRefreshEndpointResult(result: ZpcgCollectorResult): ProviderRefreshEndpointResult {
  return toSingleProviderRefreshEndpointResult(
    "zpcg-railway",
    result,
    (refresh) => refresh.acceptedDepartures,
  );
}

function toSeaWaterQualityRefreshEndpointResult(
  result: BudvaSeaWaterQualityCollectorResult,
): ProviderRefreshEndpointResult {
  return toSingleProviderRefreshEndpointResult(
    "sea-water-quality",
    result,
    (refresh) => refresh.totalLocations,
    result.cityId,
  );
}

function toMultiCitySeaWaterQualityRefreshEndpointResult(
  results: readonly BudvaSeaWaterQualityCollectorResult[],
): MultiCitySeaWaterQualityRefreshEndpointResult {
  const cities = results.map((result) => toSeaWaterQualityRefreshEndpointResult(result));

  return {
    cities,
    provider: "sea-water-quality",
    state: aggregateMultiCityRefreshState(cities),
  };
}

function toWeatherRefreshEndpointResult(
  result: WeatherCollectorResult,
): ProviderRefreshEndpointResult {
  return toSingleProviderRefreshEndpointResult(
    "weather",
    result,
    (refresh) => (refresh.success ? 1 : 0),
    result.cityId,
  );
}

function toMultiCityWeatherRefreshEndpointResult(
  results: readonly WeatherCollectorResult[],
): MultiCityWeatherRefreshEndpointResult {
  const cities = results.map((result) => toWeatherRefreshEndpointResult(result));

  return {
    cities,
    provider: "weather",
    state: aggregateMultiCityRefreshState(cities),
  };
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
    snapshotState?: ProviderRefreshEndpointResult["snapshotState"];
    state: "already-running" | "failed" | "success";
  },
  getAcceptedCount: (refresh: TRefresh) => number,
  cityId?: string,
): ProviderRefreshEndpointResult {
  if (result.state === "already-running") {
    return {
      acceptedCount: 0,
      ...(cityId ? { cityId } : {}),
      provider,
      retainedPreviousSnapshot: false,
      ...(result.snapshotState ? { snapshotState: result.snapshotState } : {}),
      state: "already-running",
      warnings: [],
    };
  }

  const refresh = result.refresh;
  if (!refresh) {
    return {
      acceptedCount: 0,
      ...(cityId ? { cityId } : {}),
      provider,
      retainedPreviousSnapshot: false,
      ...(result.snapshotState ? { snapshotState: result.snapshotState } : {}),
      state: "unavailable",
      warnings: [],
    };
  }

  return {
    acceptedCount: getAcceptedCount(refresh),
    ...(cityId ? { cityId } : {}),
    ...(refresh.errorCode ? { errorCode: refresh.errorCode } : {}),
    provider,
    retainedPreviousSnapshot: refresh.retainedPreviousSnapshot,
    ...(result.snapshotState ? { snapshotState: result.snapshotState } : {}),
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
  toVikUlcinjRefreshEndpointResult,
  toVodovodKotorRefreshEndpointResult,
  toEventRefreshEndpointResult,
  toFlightsRefreshEndpointResult,
  toGoingOutRefreshEndpointResult,
  toMultiCityGoingOutRefreshEndpointResult,
  toMultiCityAlertRefreshEndpointResult,
  toMultiCityFlightsRefreshEndpointResult,
  toMultiCitySeaWaterQualityRefreshEndpointResult,
  toMultiCityWeatherRefreshEndpointResult,
  toSeaWaterQualityRefreshEndpointResult,
  toZpcgRefreshEndpointResult,
  type EventRefreshEndpointResult,
  type MultiCityAlertRefreshEndpointResult,
  type MultiCityFlightsRefreshEndpointResult,
  type MultiCityGoingOutRefreshEndpointResult,
  type MultiCitySeaWaterQualityRefreshEndpointResult,
  type MultiCityWeatherRefreshEndpointResult,
  type ProviderRefreshEndpointResult,
};
