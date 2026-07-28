import { env } from "@/config/env";
import { initializeCityAlertCaches } from "@/modules/city-alerts/infrastructure/city-alerts-initialization";
import {
  getCedisCachePath,
  readCedisCacheResult,
} from "@/modules/city-alerts/infrastructure/cedis-cache";
import type { CedisSupportedCityId } from "@/modules/city-alerts/infrastructure/cedis-cities";
import {
  getActiveCedisContexts,
  runActiveCedisCollectors,
} from "@/modules/city-alerts/infrastructure/collect-cedis";
import { runVikpgCollector } from "@/modules/city-alerts/infrastructure/collect-vikpg";
import { readVikpgCacheResult } from "@/modules/city-alerts/infrastructure/vikpg-cache";
import { readEventCacheSnapshot } from "@/modules/events/infrastructure/events-cache";
import { initializeEventCaches } from "@/modules/events/infrastructure/events-initialization";
import { refreshAllEvents } from "@/modules/events/infrastructure/events-refresh";
import { defaultTivatTourismEventCachePath } from "@/modules/events/infrastructure/tivat-tourism-event-provider";
import { getActiveFlightsContexts } from "@/modules/flights/infrastructure/collect-podgorica-flights";
import { initializePodgoricaFlights } from "@/modules/flights/infrastructure/podgorica-flights-initialization";
import {
  getFlightsCachePath,
  type FlightsSupportedCityId,
} from "@/modules/flights/infrastructure/podgorica-flights";
import { getActiveMonteGigsGoingOutContexts } from "@/modules/going-out/infrastructure/collect-montegigs-going-out";
import {
  getGoingOutCachePath,
  getMonteGigsCitySource,
} from "@/modules/going-out/infrastructure/montegigs-going-out";
import { initializeMonteGigsGoingOut } from "@/modules/going-out/infrastructure/montegigs-going-out-initialization";
import { initializeBudvaSeaWaterQuality } from "@/modules/sea-water-quality/infrastructure/budva-sea-water-quality-initialization";
import { initializeZpcgRailwayCache } from "@/modules/transport/infrastructure/zpcg-railway-initialization";

export function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || env.NODE_ENV !== "production") return;

  const cedisContexts = getActiveCedisContexts();
  let activeCedisRefresh: ReturnType<typeof runActiveCedisCollectors> | undefined;
  void initializeCityAlertCaches({
    providers: [
      ...cedisContexts.map((context) => ({
        cachePath: getCedisCachePath(context.city.id as CedisSupportedCityId),
        enabled: env.ENABLE_CEDIS && env.CEDIS_PROVIDER_MODE === "live",
        id: "CEDIS" as const,
        readCache: () =>
          readCedisCacheResult(
            getCedisCachePath(context.city.id as CedisSupportedCityId),
            undefined,
            context.city.id as CedisSupportedCityId,
          ),
        refresh: async () => {
          activeCedisRefresh ??= runActiveCedisCollectors();
          const result = (await activeCedisRefresh).find(
            (candidate) => candidate.summary.cityId === context.city.id,
          );
          if (!result) throw new Error("CEDIS city refresh result was unavailable.");
          return result;
        },
      })),
      {
        cachePath: env.VIKPG_CACHE_PATH,
        enabled: env.ENABLE_VIKPG && env.VIKPG_PROVIDER_MODE === "live",
        id: "VIK",
        readCache: () => readVikpgCacheResult(env.VIKPG_CACHE_PATH),
        refresh: () => runVikpgCollector({ cachePath: env.VIKPG_CACHE_PATH }),
      },
    ],
  });

  void initializeZpcgRailwayCache({
    cachePath: env.ZPCG_RAILWAY_CACHE_PATH,
  });

  if (env.ENABLE_FLIGHTS) {
    for (const context of getActiveFlightsContexts()) {
      void initializePodgoricaFlights({
        cachePath: getFlightsCachePath(context.city.id as FlightsSupportedCityId),
        cityId: context.city.id as FlightsSupportedCityId,
      });
    }
  }

  if (env.ENABLE_SEA_WATER_QUALITY) {
    void initializeBudvaSeaWaterQuality({
      cachePath: env.SEA_WATER_QUALITY_CACHE_PATH,
    });
  }

  if (env.ENABLE_GOING_OUT) {
    for (const context of getActiveMonteGigsGoingOutContexts()) {
      const source = getMonteGigsCitySource(context.city.id);
      if (!source) continue;
      void initializeMonteGigsGoingOut({
        cachePath: getGoingOutCachePath(source.cityId),
        context,
      });
    }
  }

  if (env.ENABLE_EVENTS && env.EVENT_PROVIDER_MODE === "live") {
    void initializeEventCaches({
      providers: [
        {
          cachePath: env.CINEPLEXX_EVENT_CACHE_PATH,
          enabled: true,
          id: "cineplexx-podgorica",
          readCache: () => readEventCacheSnapshot(env.CINEPLEXX_EVENT_CACHE_PATH),
        },
        {
          cachePath: env.CNP_EVENT_CACHE_PATH,
          enabled: true,
          id: "cnp",
          readCache: () => readEventCacheSnapshot(env.CNP_EVENT_CACHE_PATH),
        },
        {
          cachePath: env.GLAVNI_GRAD_EVENT_CACHE_PATH,
          enabled: true,
          id: "glavni-grad-podgorica",
          readCache: () => readEventCacheSnapshot(env.GLAVNI_GRAD_EVENT_CACHE_PATH),
        },
        {
          cachePath: env.TOURISM_EVENT_CACHE_PATH,
          enabled: true,
          id: "tourism-podgorica",
          readCache: () => readEventCacheSnapshot(env.TOURISM_EVENT_CACHE_PATH),
        },
        {
          cachePath: defaultTivatTourismEventCachePath,
          enabled: true,
          id: "tourism-tivat",
          readCache: () => readEventCacheSnapshot(defaultTivatTourismEventCachePath),
        },
      ],
      refresh: refreshAllEvents,
    });
  }
}
