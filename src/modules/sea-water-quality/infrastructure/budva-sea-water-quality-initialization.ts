import { ensureCacheDirectory } from "../../../shared/lib/cache.ts";

import { readBudvaSeaWaterQualityCache } from "./budva-sea-water-quality-cache.ts";
import {
  runBudvaSeaWaterQualityCollector,
  type BudvaSeaWaterQualityCollectorResult,
} from "./collect-budva-sea-water-quality.ts";

interface InitializeBudvaSeaWaterQualityDependencies {
  cachePath: string;
  ensureDirectory?: (cachePath: string) => Promise<void>;
  log?: (message: string) => void;
  readCache?: typeof readBudvaSeaWaterQualityCache;
  refresh?: () => Promise<BudvaSeaWaterQualityCollectorResult>;
}

async function initializeBudvaSeaWaterQuality({
  cachePath,
  ensureDirectory = ensureCacheDirectory,
  log = console.info,
  readCache = readBudvaSeaWaterQualityCache,
  refresh = () => runBudvaSeaWaterQualityCollector({ cachePath }),
}: InitializeBudvaSeaWaterQualityDependencies): Promise<"cache-found" | "failed" | "refreshed"> {
  try {
    await ensureDirectory(cachePath);
    const snapshot = await readCache(cachePath);
    if (snapshot) {
      log(`Budva sea water quality: cache found at ${cachePath}.`);
      return "cache-found";
    }

    log(`Budva sea water quality: cache unavailable at ${cachePath}; refresh started.`);
    const result = await refresh();
    if (result.refresh?.success) {
      log(
        `Budva sea water quality: refresh completed with ${result.refresh.totalLocations} location(s).`,
      );
      return "refreshed";
    }
    log(
      `Budva sea water quality: refresh failed (${result.refresh?.errorCode ?? "sea-water-quality-refresh-failed"}).`,
    );
    return "failed";
  } catch (error) {
    log(
      `Budva sea water quality: initialization failed (${error instanceof Error ? error.message : "unknown error"}).`,
    );
    return "failed";
  }
}

export {
  initializeBudvaSeaWaterQuality,
  type InitializeBudvaSeaWaterQualityDependencies,
};
