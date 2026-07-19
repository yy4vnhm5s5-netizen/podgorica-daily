import { dirname } from "node:path";

import { acquireRefreshLock } from "../../../shared/lib/refresh-lock.ts";
import type { CityAlertCollectorResult } from "./city-alerts-collector.ts";
import { defaultCachePath, readCedisCache, writeCedisCache } from "./cedis-cache.ts";
import { createCedisHttpClient } from "./cedis-http-client.ts";
import { refreshCedis, type RefreshResult } from "./cedis-refresh.ts";

interface CollectorDependencies {
  cachePath?: string;
  refresh?: () => Promise<RefreshResult>;
  writeOutput?: (line: string) => void;
}

type CollectorResult = CityAlertCollectorResult;

async function runCedisCollector({
  cachePath = process.env.CEDIS_CACHE_PATH ?? defaultCachePath,
  refresh,
  writeOutput = console.log,
}: CollectorDependencies = {}): Promise<CollectorResult> {
  const lock = await acquireRefreshLock(dirname(cachePath), { lockFileName: ".cedis-refresh.lock" });
  if (!("release" in lock)) {
    const summary: CollectorResult["summary"] = {
      alertCount: 0,
      cachePath,
      cacheStatus: "unavailable",
      completedAt: new Date().toISOString(),
      retainedPreviousSnapshot: false,
      status: "already-running",
      warnings: [],
    };
    writeOutput(JSON.stringify(summary));
    return { exitCode: 0, summary };
  }

  try {
    const result = await (
      refresh ??
      (() =>
        refreshCedis({
          cache: {
            read: () => readCedisCache(cachePath),
            write: (snapshot) => writeCedisCache(snapshot, cachePath),
          },
          httpClient: createCedisHttpClient(),
        }))
    )();
    const retainedPreviousSnapshot = result.retainedPreviousSnapshot;
    const summary: CollectorResult["summary"] = {
      alertCount: result.snapshot?.alerts.length ?? 0,
      cachePath,
      cacheStatus: result.snapshot?.freshnessStatus ?? "unavailable",
      completedAt: new Date().toISOString(),
      ...(result.errorCode ? { errorCode: result.errorCode } : {}),
      retainedPreviousSnapshot,
      status: result.success ? "success" : retainedPreviousSnapshot ? "retained" : "unavailable",
      warnings: result.warnings,
    };
    writeOutput(JSON.stringify(summary));
    return { exitCode: result.success || retainedPreviousSnapshot ? 0 : 1, summary };
  } finally {
    await lock.release();
  }
}

if (process.argv[1]?.endsWith("collect-cedis.ts")) {
  void runCedisCollector().then(({ exitCode }) => {
    process.exitCode = exitCode;
  });
}

export { runCedisCollector, type CollectorDependencies, type CollectorResult };
