import { defaultCachePath, readCedisCache, writeCedisCache } from "./cedis-cache.ts";
import { createCedisHttpClient } from "./cedis-http-client.ts";
import { refreshCedis, type RefreshResult } from "./cedis-refresh.ts";

interface CollectorDependencies {
  cachePath?: string;
  refresh?: () => Promise<RefreshResult>;
  writeOutput?: (line: string) => void;
}

interface CollectorResult {
  exitCode: 0 | 1;
  summary: {
    alertCount: number;
    cachePath: string;
    cacheStatus: "fresh" | "stale" | "unavailable";
    completedAt: string;
    errorCode?: string;
    retainedPreviousSnapshot: boolean;
    status: "retained" | "success" | "unavailable";
    warnings: string[];
  };
}

async function runCedisCollector({
  cachePath = process.env.CEDIS_CACHE_PATH ?? defaultCachePath,
  refresh,
  writeOutput = console.log,
}: CollectorDependencies = {}): Promise<CollectorResult> {
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
}

if (process.argv[1]?.endsWith("collect-cedis.ts")) {
  void runCedisCollector().then(({ exitCode }) => {
    process.exitCode = exitCode;
  });
}

export { runCedisCollector, type CollectorDependencies, type CollectorResult };
