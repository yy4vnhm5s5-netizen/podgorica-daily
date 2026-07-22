import { dirname } from "node:path";

import { env } from "../../../config/env.ts";
import { acquireRefreshLock } from "../../../shared/lib/refresh-lock.ts";

import {
  createMonteGigsHttpClient,
  refreshMonteGigsGoingOut,
  type GoingOutRefreshResult,
} from "./montegigs-going-out.ts";

interface GoingOutCollectorDependencies {
  cachePath?: string;
  refresh?: () => Promise<GoingOutRefreshResult>;
  writeOutput?: (line: string) => void;
}

interface GoingOutCollectorResult {
  exitCode: 0 | 1;
  output: string;
  refresh: GoingOutRefreshResult | null;
  state: "already-running" | "failed" | "success";
}

async function runMonteGigsGoingOutCollector({
  cachePath = env.GOING_OUT_CACHE_PATH,
  refresh,
  writeOutput = console.log,
}: GoingOutCollectorDependencies = {}): Promise<GoingOutCollectorResult> {
  const lock = await acquireRefreshLock(dirname(cachePath), {
    lockFileName: ".montegigs-going-out.lock",
  });
  if (!("release" in lock)) {
    const output = "provider=montegigs-going-out state=already-running accepted=0 cache=not-run";
    writeOutput(output);
    return { exitCode: 0, output, refresh: null, state: "already-running" };
  }

  try {
    const result = await (
      refresh ??
      (() => refreshMonteGigsGoingOut({ cachePath, httpClient: createMonteGigsHttpClient() }))
    )();
    const state = result.success ? "success" : "failed";
    const cache = result.success
      ? "written"
      : result.retainedPreviousSnapshot
        ? "retained"
        : "unavailable";
    const output = [
      "provider=montegigs-going-out",
      `state=${state}`,
      `accepted=${result.acceptedEvents}`,
      `cache=${cache}`,
      ...(result.errorCode ? [`error=${result.errorCode}`] : []),
    ].join(" ");
    writeOutput(output);
    return { exitCode: result.success ? 0 : 1, output, refresh: result, state };
  } finally {
    await lock.release();
  }
}

if (process.argv[1]?.endsWith("collect-montegigs-going-out.ts")) {
  void runMonteGigsGoingOutCollector().then(({ exitCode }) => {
    process.exitCode = exitCode;
  });
}

export {
  runMonteGigsGoingOutCollector,
  type GoingOutCollectorDependencies,
  type GoingOutCollectorResult,
};
