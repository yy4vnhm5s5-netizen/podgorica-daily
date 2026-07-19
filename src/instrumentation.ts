import { env } from "@/config/env";
import { initializeCityAlertCaches } from "@/modules/city-alerts/infrastructure/city-alerts-initialization";
import { readCedisCacheResult } from "@/modules/city-alerts/infrastructure/cedis-cache";
import { runCedisCollector } from "@/modules/city-alerts/infrastructure/collect-cedis";
import { runVikpgCollector } from "@/modules/city-alerts/infrastructure/collect-vikpg";
import { readVikpgCacheResult } from "@/modules/city-alerts/infrastructure/vikpg-cache";

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
}
