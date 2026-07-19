import { dirname } from "node:path";

import { acquireRefreshLock } from "../../../shared/lib/refresh-lock.ts";
import type { CityAlertCollectorResult } from "./city-alerts-collector.ts";
import { defaultVikpgCachePath, readVikpgCache, writeVikpgCache } from "./vikpg-cache.ts";
import { createVikpgHttpClient } from "./vikpg-http-client.ts";
import { refreshVikpg, type VikpgRefreshResult } from "./vikpg-refresh.ts";

interface VikpgCollectorDependencies {
  cachePath?: string;
  refresh?: () => Promise<VikpgRefreshResult>;
  writeOutput?: (line: string) => void;
}

type VikpgCollectorResult = CityAlertCollectorResult;

async function runVikpgCollector({
  cachePath = process.env.VIKPG_CACHE_PATH ?? defaultVikpgCachePath,
  refresh,
  writeOutput = console.log,
}: VikpgCollectorDependencies = {}): Promise<VikpgCollectorResult> {
  const lock = await acquireRefreshLock(dirname(cachePath), {
    lockFileName: ".vikpg-refresh.lock",
  });
  if (!("release" in lock)) {
    const summary: VikpgCollectorResult["summary"] = {
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
        refreshVikpg({
          cache: {
            read: () => readVikpgCache(cachePath),
            write: (snapshot) => writeVikpgCache(snapshot, cachePath),
          },
          httpClient: createVikpgHttpClient(),
        }))
    )();
    const summary: VikpgCollectorResult["summary"] = {
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
    return { exitCode: result.success || result.retainedPreviousSnapshot ? 0 : 1, summary };
  } finally {
    await lock.release();
  }
}

if (process.argv[1]?.endsWith("collect-vikpg.ts")) {
  void runVikpgCollector().then(({ exitCode }) => {
    process.exitCode = exitCode;
  });
}

export { runVikpgCollector, type VikpgCollectorDependencies, type VikpgCollectorResult };
