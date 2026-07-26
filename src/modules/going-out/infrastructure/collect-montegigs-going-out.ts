import { dirname } from "node:path";

import { getDefaultCityContext } from "../../../config/city-context.ts";
import { env } from "../../../config/env.ts";
import { calculateCacheFreshness } from "../../../shared/lib/cache.ts";
import { acquireRefreshLock } from "../../../shared/lib/refresh-lock.ts";
import {
  createCityContext,
  getActiveCities,
  supportsCityCapability,
} from "../../../shared/config/cities.ts";
import type { City, CityContext, CityId } from "../../../shared/types/city.ts";

import {
  createMonteGigsHttpClient,
  getGoingOutCachePath,
  getMonteGigsCitySource,
  refreshMonteGigsGoingOut,
  type GoingOutCacheState,
  type GoingOutRefreshResult,
} from "./montegigs-going-out.ts";

interface GoingOutCollectorDependencies {
  cachePath?: string;
  context?: CityContext;
  refresh?: () => Promise<GoingOutRefreshResult>;
  writeOutput?: (line: string) => void;
}

interface GoingOutCollectorResult {
  cityId: string;
  exitCode: 0 | 1;
  output: string;
  refresh: GoingOutRefreshResult | null;
  snapshotState: GoingOutCacheState | "not-run";
  state: "already-running" | "failed" | "success";
}

interface ActiveGoingOutCollectorDependencies {
  cities?: readonly City[];
  createContext?: (cityId: CityId) => CityContext;
  runCollector?: (context: CityContext) => Promise<GoingOutCollectorResult>;
}

function getActiveMonteGigsGoingOutContexts(
  cities: readonly City[] = getActiveCities(),
  createContext: (cityId: CityId) => CityContext = createCityContext,
) {
  return cities
    .filter(
      (city) =>
        city.isActive &&
        supportsCityCapability(city, "goingOut") &&
        Boolean(getMonteGigsCitySource(city.id)),
    )
    .map((city) => createContext(city.id));
}

async function runMonteGigsGoingOutCollector({
  cachePath,
  context = getDefaultCityContext(),
  refresh,
  writeOutput = console.log,
}: GoingOutCollectorDependencies = {}): Promise<GoingOutCollectorResult> {
  const source = getMonteGigsCitySource(context.city.id);
  if (!source) {
    const output = [
      "provider=montegigs-going-out",
      `cityId=${context.city.id}`,
      "state=failed",
      "accepted=0",
      "snapshot=unavailable",
      "retainedPreviousSnapshot=false",
      "error=montegigs-city-unsupported",
    ].join(" ");
    writeOutput(output);
    return {
      cityId: context.city.id,
      exitCode: 1,
      output,
      refresh: null,
      snapshotState: "unavailable",
      state: "failed",
    };
  }

  const resolvedCachePath = cachePath ?? getGoingOutCachePath(source.cityId);
  const lock = await acquireRefreshLock(dirname(resolvedCachePath), {
    lockFileName: `.montegigs-going-out-${source.cityId}.lock`,
  });
  if (!("release" in lock)) {
    const output = [
      "provider=montegigs-going-out",
      `cityId=${source.cityId}`,
      "state=already-running",
      "accepted=0",
      "snapshot=not-run",
      "retainedPreviousSnapshot=false",
    ].join(" ");
    writeOutput(output);
    return {
      cityId: source.cityId,
      exitCode: 0,
      output,
      refresh: null,
      snapshotState: "not-run",
      state: "already-running",
    };
  }

  try {
    const result = await (
      refresh ??
      (() =>
        refreshMonteGigsGoingOut({
          cachePath: resolvedCachePath,
          context,
          httpClient: createMonteGigsHttpClient(),
        }))
    )();
    const state = result.success ? "success" : "failed";
    const snapshotState = result.snapshot
      ? calculateCacheFreshness(
          new Date(result.snapshot.fetchedAt),
          new Date(),
          env.GOING_OUT_CACHE_FRESHNESS_MINUTES,
        )
      : "unavailable";
    const output = [
      "provider=montegigs-going-out",
      `cityId=${source.cityId}`,
      `state=${state}`,
      `accepted=${result.acceptedEvents}`,
      `snapshot=${snapshotState}`,
      `retainedPreviousSnapshot=${result.retainedPreviousSnapshot}`,
      ...(result.errorCode ? [`error=${result.errorCode}`] : []),
    ].join(" ");
    writeOutput(output);
    return {
      cityId: source.cityId,
      exitCode: result.success ? 0 : 1,
      output,
      refresh: result,
      snapshotState,
      state,
    };
  } finally {
    await lock.release();
  }
}

async function runActiveMonteGigsGoingOutCollectors({
  cities,
  createContext,
  runCollector = (context) => runMonteGigsGoingOutCollector({ context }),
}: ActiveGoingOutCollectorDependencies = {}) {
  const results: GoingOutCollectorResult[] = [];

  for (const context of getActiveMonteGigsGoingOutContexts(cities, createContext)) {
    results.push(await runCollector(context));
  }

  return results;
}

if (process.argv[1]?.endsWith("collect-montegigs-going-out.ts")) {
  void runActiveMonteGigsGoingOutCollectors().then((results) => {
    process.exitCode = results.some(({ exitCode }) => exitCode !== 0) ? 1 : 0;
  });
}

export {
  getActiveMonteGigsGoingOutContexts,
  runMonteGigsGoingOutCollector,
  runActiveMonteGigsGoingOutCollectors,
  type ActiveGoingOutCollectorDependencies,
  type GoingOutCollectorDependencies,
  type GoingOutCollectorResult,
};
