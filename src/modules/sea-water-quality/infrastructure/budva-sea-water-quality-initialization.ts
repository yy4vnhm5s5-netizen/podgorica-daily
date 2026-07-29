import { ensureCacheDirectory } from "../../../shared/lib/cache.ts";

import { readBudvaSeaWaterQualityCache } from "./budva-sea-water-quality-cache.ts";
import {
  runBudvaSeaWaterQualityCollector,
  type BudvaSeaWaterQualityCollectorResult,
} from "./collect-budva-sea-water-quality.ts";
import type { SeaWaterQualitySupportedCityId } from "./sea-water-quality-cities.ts";

interface InitializeBudvaSeaWaterQualityDependencies {
  cachePath: string;
  cityId?: SeaWaterQualitySupportedCityId;
  ensureDirectory?: (cachePath: string) => Promise<void>;
  log?: (message: string) => void;
  readCache?: typeof readBudvaSeaWaterQualityCache;
  refresh?: () => Promise<BudvaSeaWaterQualityCollectorResult>;
}

async function initializeBudvaSeaWaterQuality({
  cachePath,
  cityId = "budva",
  ensureDirectory = ensureCacheDirectory,
  log = console.info,
  readCache = readBudvaSeaWaterQualityCache,
  refresh = () => runBudvaSeaWaterQualityCollector({ cachePath, cityId }),
}: InitializeBudvaSeaWaterQualityDependencies): Promise<"cache-found" | "failed" | "refreshed"> {
  const label = `Sea water quality (${cityId})`;
  try {
    await ensureDirectory(cachePath);
    const snapshot = await readCache(cachePath);
    if (snapshot) {
      log(`${label}: cache found at ${cachePath}.`);
      return "cache-found";
    }

    log(`${label}: cache unavailable at ${cachePath}; refresh started.`);
    const result = await refresh();
    if (result.refresh?.success) {
      log(`${label}: refresh completed with ${result.refresh.totalLocations} location(s).`);
      return "refreshed";
    }
    log(
      `${label}: refresh failed (${result.refresh?.errorCode ?? "sea-water-quality-refresh-failed"}).`,
    );
    return "failed";
  } catch (error) {
    log(
      `${label}: initialization failed (${error instanceof Error ? error.message : "unknown error"}).`,
    );
    return "failed";
  }
}

export {
  initializeBudvaSeaWaterQuality,
  type InitializeBudvaSeaWaterQualityDependencies,
};
