import { dirname } from "node:path";

import { env } from "../../../config/env.ts";
import { acquireRefreshLock } from "../../../shared/lib/refresh-lock.ts";

import {
  createPodgoricaFlightsHttpClient,
  refreshPodgoricaFlights,
  type PodgoricaFlightsRefreshResult,
} from "./podgorica-flights.ts";

interface PodgoricaFlightsCollectorDependencies {
  cachePath?: string;
  refresh?: () => Promise<PodgoricaFlightsRefreshResult>;
  writeOutput?: (line: string) => void;
}

interface PodgoricaFlightsCollectorResult {
  exitCode: 0 | 1;
  output: string;
  refresh: PodgoricaFlightsRefreshResult | null;
  state: "already-running" | "failed" | "success";
}

async function runPodgoricaFlightsCollector({
  cachePath = env.PODGORICA_FLIGHTS_CACHE_PATH,
  refresh,
  writeOutput = console.log,
}: PodgoricaFlightsCollectorDependencies = {}): Promise<PodgoricaFlightsCollectorResult> {
  const lock = await acquireRefreshLock(dirname(cachePath), {
    lockFileName: ".podgorica-flights-refresh.lock",
  });
  if (!("release" in lock)) {
    const output = "provider=podgorica-airport state=already-running accepted=0 cache=not-run";
    writeOutput(output);
    return { exitCode: 0, output, refresh: null, state: "already-running" };
  }

  try {
    const result = await (
      refresh ??
      (() =>
        refreshPodgoricaFlights({
          cachePath,
          httpClient: createPodgoricaFlightsHttpClient(),
        }))
    )();
    const state = result.success ? "success" : "failed";
    const cache = result.success
      ? "written"
      : result.retainedPreviousSnapshot
        ? "retained"
        : "unavailable";
    const output = [
      "provider=podgorica-airport",
      `state=${state}`,
      `accepted=${result.acceptedFlights}`,
      `cache=${cache}`,
      ...(result.errorCode ? [`error=${result.errorCode}`] : []),
    ].join(" ");
    writeOutput(output);

    return { exitCode: result.success ? 0 : 1, output, refresh: result, state };
  } finally {
    await lock.release();
  }
}

if (process.argv[1]?.endsWith("collect-podgorica-flights.ts")) {
  void runPodgoricaFlightsCollector().then(({ exitCode }) => {
    process.exitCode = exitCode;
  });
}

export {
  runPodgoricaFlightsCollector,
  type PodgoricaFlightsCollectorDependencies,
  type PodgoricaFlightsCollectorResult,
};
