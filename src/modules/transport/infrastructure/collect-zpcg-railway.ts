import { dirname } from "node:path";

import { acquireRefreshLock } from "../../../shared/lib/refresh-lock.ts";
import {
  createZpcgHttpClient,
  defaultZpcgRailwayCachePath,
  refreshZpcgRailway,
  type ZpcgRefreshResult,
} from "./zpcg-railway.ts";

interface ZpcgCollectorDependencies {
  cachePath?: string;
  refresh?: () => Promise<ZpcgRefreshResult>;
  writeOutput?: (line: string) => void;
}

interface ZpcgCollectorResult {
  exitCode: 0 | 1;
  output: string;
  refresh: ZpcgRefreshResult | null;
  state: "already-running" | "failed" | "success";
}

async function runZpcgRailwayCollector({
  cachePath = process.env.ZPCG_RAILWAY_CACHE_PATH ?? defaultZpcgRailwayCachePath,
  refresh,
  writeOutput = console.log,
}: ZpcgCollectorDependencies = {}): Promise<ZpcgCollectorResult> {
  const lock = await acquireRefreshLock(dirname(cachePath), {
    lockFileName: ".zpcg-railway-refresh.lock",
  });

  if (!("release" in lock)) {
    const output = "provider=zpcg-railway state=already-running phase=cache accepted=0 cache=not-run";
    writeOutput(output);
    return { exitCode: 0, output, refresh: null, state: "already-running" };
  }

  try {
    const result = await (
      refresh ??
      (() =>
        refreshZpcgRailway({
          cachePath,
          httpClient: createZpcgHttpClient(),
        }))
    )();
    const state = result.success ? "success" : "failed";
    const cache = result.success
      ? "written"
      : result.retainedPreviousSnapshot
        ? "retained"
        : "unavailable";
    const output = [
      "provider=zpcg-railway",
      `state=${state}`,
      `phase=${result.phase}`,
      `accepted=${result.acceptedDepartures}`,
      `cache=${cache}`,
      ...(result.errorCode ? [`error=${result.errorCode}`] : []),
    ].join(" ");

    writeOutput(output);

    return {
      exitCode: result.success ? 0 : 1,
      output,
      refresh: result,
      state,
    };
  } finally {
    await lock.release();
  }
}

if (process.argv[1]?.endsWith("collect-zpcg-railway.ts")) {
  void runZpcgRailwayCollector().then(({ exitCode }) => {
    process.exitCode = exitCode;
  });
}

export {
  runZpcgRailwayCollector,
  type ZpcgCollectorDependencies,
  type ZpcgCollectorResult,
};
