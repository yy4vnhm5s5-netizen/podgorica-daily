import {
  createCityContext,
  getActiveCities,
  isCitySupportedByProvider,
  supportsCityCapability,
} from "@/shared/config/cities";
import { getActiveCityAlerts } from "@/modules/city-alerts/application/get-active-city-alerts";
import {
  getPowerOutages,
  type PowerOutagesReadResult,
} from "@/modules/city-alerts/application/get-power-outages";
import {
  getCityEvents,
  type EventProviderReadState,
} from "@/modules/events/application/get-city-events";
import {
  eventProviderRegistry,
  getEnabledEventProviders,
} from "@/modules/events/infrastructure/event-provider-registry";
import {
  getFuelPrices,
  type FuelPricesReadResult,
} from "@/modules/fuel/infrastructure/gov-me-fuel-prices";
import { getAirportFlights } from "@/modules/flights/application/get-podgorica-flights";
import { selectUpcomingFlights } from "@/modules/flights/domain/flight";
import { getAirportFlightsSourceForCity } from "@/modules/flights/infrastructure/airport-flights-config";
import type { AirportFlightsCacheResult } from "@/modules/flights/infrastructure/podgorica-flights";
import { getGoingOutEvents } from "@/modules/going-out/application/get-going-out-events";
import type { GoingOutCacheResult } from "@/modules/going-out/infrastructure/montegigs-going-out";
import { getParkingAvailability } from "@/modules/parking/application/get-parking-availability";
import {
  readParkingCacheResult,
  type ParkingCacheResult,
} from "@/modules/parking/infrastructure/parking-cache";
import type { ParkingAvailabilityReadModel } from "@/modules/parking/domain/parking-availability";
import { getBudvaSeaWaterQuality } from "@/modules/sea-water-quality/application/get-budva-sea-water-quality";
import { getSeaWaterQualityHistory } from "@/modules/sea-water-quality/application/get-sea-water-quality-history";
import type { BudvaSeaWaterQualityCacheResult } from "@/modules/sea-water-quality/infrastructure/budva-sea-water-quality-cache";
import type { SeaWaterQualityHistoryCacheResult } from "@/modules/sea-water-quality/infrastructure/sea-water-quality-history-cache";
import { getRailwayDepartures } from "@/modules/transport/application/get-railway-departures";
import type { RailwayDeparturesResult } from "@/modules/transport/application/get-railway-departures";
import { selectUpcomingRailwayDepartures } from "@/modules/transport/domain/railway-departure";
import {
  getCachedCurrentWeather,
  type CachedWeatherResult,
} from "@/modules/weather/infrastructure/weather-cache";
import type { City, CityId } from "@/shared/types/city";

type SourceHealthSnapshotState = "disabled" | "fresh" | "mock" | "stale" | "unavailable";
type SourceHealthPublicState = SourceHealthSnapshotState | "empty";

interface SourceHealthEntry {
  providerId: string;
  publicState: SourceHealthPublicState;
  snapshotState: SourceHealthSnapshotState;
  cityId?: CityId;
  displayableRecordCount?: number;
  effectiveDate?: string;
  fetchedAt?: string;
  lastRefreshError?: string;
  lastSuccessfulRefreshAt?: string;
  nextCalculationDate?: string;
  rejectedRecordCount?: number;
  sourceUpdatedAt?: string;
  storedRecordCount?: number;
  warningCount?: number;
}

function getPublicState(
  snapshotState: SourceHealthSnapshotState,
  displayableRecordCount: number,
): SourceHealthPublicState {
  if (snapshotState === "disabled" || snapshotState === "unavailable") return snapshotState;
  return displayableRecordCount > 0 ? snapshotState : "empty";
}

function toIsoString(value: Date | undefined) {
  return value?.toISOString();
}

function createEventSourceHealthEntry(
  cityId: CityId,
  provider: EventProviderReadState,
): SourceHealthEntry {
  const { status } = provider;
  const snapshotState = provider.state;
  const displayableRecordCount = status.finalEventCount;

  return {
    providerId: provider.id,
    publicState: getPublicState(snapshotState, displayableRecordCount),
    snapshotState,
    cityId,
    ...(status.fetchedAt ? { fetchedAt: status.fetchedAt } : {}),
    ...(status.lastError ? { lastRefreshError: status.lastError } : {}),
    ...(status.lastSuccessfulRefreshAt
      ? { lastSuccessfulRefreshAt: status.lastSuccessfulRefreshAt }
      : {}),
    ...(status.rejectedCount !== undefined ? { rejectedRecordCount: status.rejectedCount } : {}),
    storedRecordCount: displayableRecordCount,
    warningCount: status.parserWarnings.length,
  };
}

function createDisabledSourceHealthEntry(cityId: CityId, providerId: string): SourceHealthEntry {
  return {
    providerId,
    publicState: "disabled",
    snapshotState: "disabled",
    cityId,
  };
}

function createGoingOutSourceHealthEntry(
  cityId: CityId,
  result: GoingOutCacheResult,
): SourceHealthEntry {
  const displayableRecordCount = result.events.length;

  return {
    providerId: "montegigs-going-out",
    publicState: getPublicState(result.state, displayableRecordCount),
    snapshotState: result.state,
    cityId,
    displayableRecordCount,
    ...(result.lastSuccessfulRefreshAt
      ? { lastSuccessfulRefreshAt: result.lastSuccessfulRefreshAt }
      : {}),
  };
}

function createParkingSourceHealthEntry({
  cached,
  publicResult,
}: {
  cached: ParkingCacheResult;
  publicResult: ParkingAvailabilityReadModel;
}): SourceHealthEntry {
  const displayableRecordCount = publicResult.locations.length;

  return {
    providerId: "parking-servis-podgorica",
    publicState: getPublicState(cached.state, displayableRecordCount),
    snapshotState: cached.state,
    cityId: "podgorica",
    displayableRecordCount,
    ...(cached.snapshot?.fetchedAt ? { fetchedAt: cached.snapshot.fetchedAt } : {}),
    ...(cached.snapshot?.lastRefreshError
      ? { lastRefreshError: cached.snapshot.lastRefreshError }
      : {}),
    ...(cached.snapshot?.lastSuccessfulRefreshAt
      ? { lastSuccessfulRefreshAt: cached.snapshot.lastSuccessfulRefreshAt }
      : {}),
    storedRecordCount: cached.snapshot?.locations.length ?? 0,
  };
}

function createFuelSourceHealthEntry(result: FuelPricesReadResult): SourceHealthEntry {
  const [currentCalculation] = result.calculations;
  const displayableRecordCount = result.calculations.length;

  return {
    providerId: "fuel-prices",
    publicState: getPublicState(result.freshnessStatus, displayableRecordCount),
    snapshotState: result.freshnessStatus,
    displayableRecordCount,
    ...(currentCalculation?.effectiveDate
      ? { effectiveDate: currentCalculation.effectiveDate }
      : {}),
    ...(result.lastSuccessfulUpdate
      ? { lastSuccessfulRefreshAt: toIsoString(result.lastSuccessfulUpdate) }
      : {}),
    ...(currentCalculation?.nextCalculationDate
      ? { nextCalculationDate: currentCalculation.nextCalculationDate }
      : {}),
    ...(currentCalculation?.publishedAt ? { sourceUpdatedAt: currentCalculation.publishedAt } : {}),
    storedRecordCount: displayableRecordCount,
  };
}

function createFlightsSourceHealthEntry(
  cityId: CityId,
  result: AirportFlightsCacheResult,
  now = new Date(),
): SourceHealthEntry {
  const displayableRecordCount = selectUpcomingFlights(
    result.flights,
    now,
    Number.MAX_SAFE_INTEGER,
  ).length;

  return {
    providerId: "airport-flights",
    publicState: getPublicState(result.state, displayableRecordCount),
    snapshotState: result.state,
    cityId,
    displayableRecordCount,
    storedRecordCount: result.flights.length,
    ...(result.lastSuccessfulRefreshAt
      ? { lastSuccessfulRefreshAt: result.lastSuccessfulRefreshAt }
      : {}),
  };
}

function createCedisSourceHealthEntry(
  cityId: CityId,
  result: PowerOutagesReadResult,
): SourceHealthEntry {
  const displayableRecordCount = result.outages.length;

  return {
    providerId: "cedis",
    publicState: result.status === "empty" ? "empty" : result.freshnessStatus,
    snapshotState: result.freshnessStatus,
    cityId,
    displayableRecordCount,
    ...(result.status !== "unavailable" && result.lastSuccessfulUpdate
      ? { lastSuccessfulRefreshAt: toIsoString(result.lastSuccessfulUpdate) }
      : {}),
  };
}

function createWaterSourceHealthEntry({
  cityId,
  displayableRecordCount,
  freshnessStatus,
  lastSuccessfulUpdate,
  providerId,
  providerMode,
}: {
  cityId: CityId;
  displayableRecordCount: number;
  freshnessStatus: "fresh" | "stale" | "unavailable";
  lastSuccessfulUpdate?: Date;
  providerId: string;
  providerMode: "disabled" | "live" | "mock";
}): SourceHealthEntry {
  const snapshotState = providerMode === "disabled" ? "disabled" : freshnessStatus;

  return {
    providerId,
    publicState: getPublicState(snapshotState, displayableRecordCount),
    snapshotState,
    cityId,
    displayableRecordCount,
    ...(lastSuccessfulUpdate ? { lastSuccessfulRefreshAt: toIsoString(lastSuccessfulUpdate) } : {}),
  };
}

function createSeaWaterCurrentSourceHealthEntry(
  cityId: CityId,
  result: BudvaSeaWaterQualityCacheResult,
): SourceHealthEntry {
  const displayableRecordCount = result.summary?.totalLocations ?? 0;

  return {
    providerId: "sea-water-quality-current",
    publicState: getPublicState(result.state, displayableRecordCount),
    snapshotState: result.state,
    cityId,
    displayableRecordCount,
    ...(result.lastSuccessfulRefreshAt
      ? { lastSuccessfulRefreshAt: result.lastSuccessfulRefreshAt }
      : {}),
    storedRecordCount: displayableRecordCount,
  };
}

function createSeaWaterHistorySourceHealthEntry(
  cityId: CityId,
  result: SeaWaterQualityHistoryCacheResult,
): SourceHealthEntry {
  const displayableRecordCount = result.history?.locations.length ?? 0;

  return {
    providerId: "sea-water-quality-history",
    publicState: getPublicState(result.state, displayableRecordCount),
    snapshotState: result.state,
    cityId,
    displayableRecordCount,
    ...(result.lastSuccessfulRefreshAt
      ? { lastSuccessfulRefreshAt: result.lastSuccessfulRefreshAt }
      : {}),
    storedRecordCount: displayableRecordCount,
  };
}

function createRailwaySourceHealthEntry(
  cityId: CityId,
  result: RailwayDeparturesResult,
  now: Date,
): SourceHealthEntry {
  const storedRecordCount = result.departures.length;
  const displayableRecordCount = selectUpcomingRailwayDepartures(
    result.departures,
    now,
    Number.MAX_SAFE_INTEGER,
  ).length;

  return {
    providerId: "zpcg-railway",
    publicState: getPublicState(result.state, displayableRecordCount),
    snapshotState: result.state,
    cityId,
    displayableRecordCount,
    storedRecordCount,
  };
}

function createWeatherSourceHealthEntry(
  cityId: CityId,
  result: CachedWeatherResult,
): SourceHealthEntry {
  const displayableRecordCount = result.weather ? 1 : 0;

  return {
    providerId: "open-meteo",
    publicState: getPublicState(result.state, displayableRecordCount),
    snapshotState: result.state,
    cityId,
    displayableRecordCount,
    ...(result.fetchedAt ? { fetchedAt: result.fetchedAt } : {}),
  };
}

async function getSourceHealth(now = new Date(), cities: readonly City[] = getActiveCities()) {
  const contexts = cities.map((city) => createCityContext(city.id));
  const enabledEventProviders = getEnabledEventProviders();
  const enabledEventProviderIds = new Set(
    enabledEventProviders.map((provider) => provider.metadata.id),
  );
  const parkingContext = contexts.find((context) => context.city.id === "podgorica");

  const [
    eventEntries,
    goingOutEntries,
    parkingEntry,
    fuelEntry,
    flightsEntries,
    cedisEntries,
    waterEntries,
    seaWaterEntries,
    railwayEntries,
    weatherEntries,
  ] = await Promise.all([
    Promise.all(
      contexts
        .filter((context) => supportsCityCapability(context.city, "events"))
        .map(async (context) => {
          const events = await getCityEvents(context, enabledEventProviders);
          const entriesById = new Map(events.providers.map((provider) => [provider.id, provider]));
          return eventProviderRegistry.flatMap((provider) => {
            if (!isCitySupportedByProvider(context.city, provider.metadata.supportedCityIds))
              return [];
            if (!enabledEventProviderIds.has(provider.metadata.id)) {
              return [createDisabledSourceHealthEntry(context.city.id, provider.metadata.id)];
            }
            const entry = entriesById.get(provider.metadata.id);
            return entry ? [createEventSourceHealthEntry(context.city.id, entry)] : [];
          });
        }),
    ).then((entries) => entries.flat()),
    Promise.all(
      contexts
        .filter((context) => supportsCityCapability(context.city, "goingOut"))
        .map(async (context) =>
          createGoingOutSourceHealthEntry(context.city.id, await getGoingOutEvents(context)),
        ),
    ),
    parkingContext
      ? Promise.all([readParkingCacheResult(undefined, now), getParkingAvailability({ now })]).then(
          ([cached, publicResult]) => createParkingSourceHealthEntry({ cached, publicResult }),
        )
      : undefined,
    getFuelPrices().then(createFuelSourceHealthEntry),
    Promise.all(
      contexts
        .filter(
          (context) =>
            supportsCityCapability(context.city, "flights") &&
            getAirportFlightsSourceForCity(context.city.id) !== undefined,
        )
        .map(async (context) =>
          createFlightsSourceHealthEntry(context.city.id, await getAirportFlights(context), now),
        ),
    ),
    Promise.all(
      contexts
        .filter((context) => supportsCityCapability(context.city, "electricity"))
        .map(async (context) =>
          createCedisSourceHealthEntry(context.city.id, await getPowerOutages(context)),
        ),
    ),
    Promise.all(
      contexts
        .filter((context) => supportsCityCapability(context.city, "water"))
        .map(async (context) => {
          const result = await getActiveCityAlerts(context);
          const waterSource =
            result.status === "error"
              ? undefined
              : result.metadata.sources.find(({ id }) => id !== "cedis");
          if (!waterSource) return [];
          const waterAlerts =
            result.status === "success"
              ? result.data.filter((alert) => alert.type !== "powerOutage")
              : [];
          return [
            createWaterSourceHealthEntry({
              cityId: context.city.id,
              displayableRecordCount: waterAlerts.length,
              freshnessStatus: waterSource.freshnessStatus,
              ...(waterSource.lastSuccessfulUpdate
                ? { lastSuccessfulUpdate: waterSource.lastSuccessfulUpdate }
                : {}),
              providerId: waterSource.id,
              providerMode: waterSource.providerMode,
            }),
          ];
        }),
    ).then((entries) => entries.flat()),
    Promise.all(
      contexts
        .filter((context) => supportsCityCapability(context.city, "seaWaterQuality"))
        .map(async (context) => {
          const [current, history] = await Promise.all([
            getBudvaSeaWaterQuality(context),
            getSeaWaterQualityHistory(context),
          ]);
          return [
            createSeaWaterCurrentSourceHealthEntry(context.city.id, current),
            createSeaWaterHistorySourceHealthEntry(context.city.id, history),
          ];
        }),
    ).then((entries) => entries.flat()),
    Promise.all(
      contexts
        .filter((context) => supportsCityCapability(context.city, "railway"))
        .map(async (context) =>
          createRailwaySourceHealthEntry(context.city.id, await getRailwayDepartures(context), now),
        ),
    ),
    Promise.all(
      contexts
        .filter((context) => supportsCityCapability(context.city, "weather"))
        .map(async (context) =>
          createWeatherSourceHealthEntry(
            context.city.id,
            await getCachedCurrentWeather(context, { now }),
          ),
        ),
    ),
  ]);

  return [
    ...eventEntries,
    ...goingOutEntries,
    ...(parkingEntry ? [parkingEntry] : []),
    fuelEntry,
    ...flightsEntries,
    ...cedisEntries,
    ...waterEntries,
    ...seaWaterEntries,
    ...railwayEntries,
    ...weatherEntries,
  ].toSorted(
    (left, right) =>
      (left.cityId ?? "").localeCompare(right.cityId ?? "") ||
      left.providerId.localeCompare(right.providerId),
  );
}

export {
  createCedisSourceHealthEntry,
  createDisabledSourceHealthEntry,
  createEventSourceHealthEntry,
  createFlightsSourceHealthEntry,
  createFuelSourceHealthEntry,
  createGoingOutSourceHealthEntry,
  createParkingSourceHealthEntry,
  createRailwaySourceHealthEntry,
  createSeaWaterCurrentSourceHealthEntry,
  createSeaWaterHistorySourceHealthEntry,
  createWaterSourceHealthEntry,
  createWeatherSourceHealthEntry,
  getSourceHealth,
  type SourceHealthEntry,
  type SourceHealthPublicState,
  type SourceHealthSnapshotState,
};
