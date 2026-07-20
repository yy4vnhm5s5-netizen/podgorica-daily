import { defaultAmscgCachePath, readAmscgCache, writeAmscgCache } from "./amscg-cache.ts";
import { createAmscgHttpClient } from "./amscg-http-client.ts";
import { refreshAmscg, type AmscgRefreshResult } from "./amscg-refresh.ts";

async function runAmscgCollector({
  cachePath = env.AMSCG_CACHE_PATH ?? defaultAmscgCachePath,
  refresh,
  writeOutput = console.log,
}: {
  cachePath?: string;
  refresh?: () => Promise<AmscgRefreshResult>;
  writeOutput?: (line: string) => void;
} = {}) {
  const result = await (
    refresh ??
    (() =>
      refreshAmscg({
        cache: {
          read: () => readAmscgCache(cachePath),
          write: (snapshot) => writeAmscgCache(snapshot, cachePath),
        },
        httpClient: createAmscgHttpClient(),
      }))
  )();
  const summary = {
    alertCount: result.snapshot?.alerts.length ?? 0,
    cachePath,
    cacheStatus: result.snapshot?.freshnessStatus ?? "unavailable",
    completedAt: new Date().toISOString(),
    ...(result.errorCode ? { errorCode: result.errorCode } : {}),
    retainedPreviousSnapshot: result.retainedPreviousSnapshot,
    status: result.success
      ? "success"
      : result.retainedPreviousSnapshot
        ? "retained"
        : "unavailable",
    warnings: result.warnings,
  };
  writeOutput(JSON.stringify(summary));
  return { exitCode: result.success || result.retainedPreviousSnapshot ? 0 : 1, summary } as const;
}

if (process.argv[1]?.endsWith("collect-amscg.ts")) {
  void runAmscgCollector().then(({ exitCode }) => {
    process.exitCode = exitCode;
  });
}

export { runAmscgCollector };
import { env } from "../../../config/env.ts";
