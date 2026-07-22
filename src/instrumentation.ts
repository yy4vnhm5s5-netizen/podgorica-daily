import { env } from "@/config/env";
import { initializeCityAlertCaches } from "@/modules/city-alerts/infrastructure/city-alerts-initialization";
import { readCedisCacheResult } from "@/modules/city-alerts/infrastructure/cedis-cache";
import { runCedisCollector } from "@/modules/city-alerts/infrastructure/collect-cedis";
import { runVikpgCollector } from "@/modules/city-alerts/infrastructure/collect-vikpg";
import { readVikpgCacheResult } from "@/modules/city-alerts/infrastructure/vikpg-cache";
import { readEventCacheSnapshot } from "@/modules/events/infrastructure/events-cache";
import { initializeEventCaches } from "@/modules/events/infrastructure/events-initialization";
import { refreshAllEvents } from "@/modules/events/infrastructure/events-refresh";
import { initializePodgoricaFlights } from "@/modules/flights/infrastructure/podgorica-flights-initialization";
import { initializeZpcgRailwayCache } from "@/modules/transport/infrastructure/zpcg-railway-initialization";

export function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || env.NODE_ENV !== "production") return;

  void initializeCityAlertCaches({
    providers: [
      {
        cachePath: env.CEDIS_CACHE_PATH,
        enabled: env.ENABLE_CEDIS && env.CEDIS_PROVIDER_MODE === "live",
        id: "CEDIS",
        readCache: () => readCedisCacheResult(env.CEDIS_CACHE_PATH),
        refresh: () => runCedisCollector({ cachePath: env.CEDIS_CACHE_PATH }),
      },
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
    void initializePodgoricaFlights({
      cachePath: env.PODGORICA_FLIGHTS_CACHE_PATH,
    });
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
          cachePath: env.KIC_EVENT_CACHE_PATH,
          enabled: true,
          id: "kic",
          readCache: () => readEventCacheSnapshot(env.KIC_EVENT_CACHE_PATH),
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
      ],
      refresh: refreshAllEvents,
    });
  }
}
