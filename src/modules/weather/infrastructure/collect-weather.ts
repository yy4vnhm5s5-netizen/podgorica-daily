import { dirname } from "node:path";

import { acquireRefreshLock } from "../../../shared/lib/refresh-lock.ts";
import {
  createCityContext,
  getActiveCities,
  supportsCityCapability,
} from "../../../shared/config/cities.ts";
import type { City, CityContext, CityId } from "../../../shared/types/city.ts";

import { calculateWeatherSnapshotState, getWeatherCachePath } from "./weather-cache.ts";
import { refreshWeather, type WeatherRefreshResult } from "./weather-refresh.ts";

const weatherRefreshConcurrency = 2;

interface WeatherCollectorDependencies {
  cachePath?: string;
  context: CityContext;
  refresh?: () => Promise<WeatherRefreshResult>;
  writeOutput?: (line: string) => void;
}

interface WeatherCollectorResult {
  cityId: CityId;
  exitCode: 0 | 1;
  output: string;
  refresh: WeatherRefreshResult | null;
  snapshotState: "fresh" | "stale" | "unavailable" | "not-run";
  state: "already-running" | "failed" | "success";
}

interface ActiveWeatherCollectorDependencies {
  cities?: readonly City[];
  createContext?: (cityId: CityId) => CityContext;
  lockDirectory?: string;
  runCollector?: (context: CityContext) => Promise<WeatherCollectorResult>;
}

function getActiveWeatherContexts(
  cities: readonly City[] = getActiveCities(),
  createContext: (cityId: CityId) => CityContext = createCityContext,
) {
  return cities
    .filter(
      (city) =>
        city.isActive &&
        supportsCityCapability(city, "weather") &&
        Number.isFinite(city.latitude) &&
        Number.isFinite(city.longitude) &&
        city.latitude >= -90 &&
        city.latitude <= 90 &&
        city.longitude >= -180 &&
        city.longitude <= 180 &&
        city.timezone.trim().length > 0,
    )
    .map((city) => createContext(city.id));
}

async function runWeatherCollector({
  context,
  cachePath,
  refresh,
  writeOutput = console.log,
}: WeatherCollectorDependencies): Promise<WeatherCollectorResult> {
  const resolvedCachePath = cachePath ?? getWeatherCachePath(context.city.id);
  const result = await (
    refresh ?? (() => refreshWeather({ cachePath: resolvedCachePath, context }))
  )();
  const state = result.success ? "success" : "failed";
  const snapshotState = result.snapshot
    ? calculateWeatherSnapshotState(new Date(result.snapshot.fetchedAt))
    : "unavailable";
  const output = [
    "provider=weather",
    `cityId=${context.city.id}`,
    `state=${state}`,
    `accepted=${result.success ? 1 : 0}`,
    `snapshot=${result.success ? "written" : result.retainedPreviousSnapshot ? "retained" : "unavailable"}`,
    ...(result.errorCode ? [`error=${result.errorCode}`] : []),
  ].join(" ");
  writeOutput(output);

  return {
    cityId: context.city.id,
    exitCode: result.success ? 0 : 1,
    output,
    refresh: result,
    snapshotState,
    state,
  };
}

async function runActiveWeatherCollectors({
  cities,
  createContext,
  lockDirectory,
  runCollector = (context) => runWeatherCollector({ context }),
}: ActiveWeatherCollectorDependencies = {}): Promise<WeatherCollectorResult[]> {
  const contexts = getActiveWeatherContexts(cities, createContext);
  if (contexts.length === 0) return [];

  const lock = await acquireRefreshLock(
    lockDirectory ?? dirname(getWeatherCachePath(contexts[0]!.city.id)),
    {
      lockFileName: ".weather-refresh.lock",
    },
  );
  if (!("release" in lock)) {
    return contexts.map((context) => createAlreadyRunningResult(context));
  }

  try {
    return await runWithBoundedConcurrency(contexts, runCollector);
  } finally {
    await lock.release();
  }
}

function createAlreadyRunningResult(context: CityContext): WeatherCollectorResult {
  return {
    cityId: context.city.id,
    exitCode: 0,
    output: [
      "provider=weather",
      `cityId=${context.city.id}`,
      "state=already-running",
      "accepted=0",
      "snapshot=not-run",
    ].join(" "),
    refresh: null,
    snapshotState: "not-run",
    state: "already-running",
  };
}

async function runWithBoundedConcurrency(
  contexts: readonly CityContext[],
  runCollector: (context: CityContext) => Promise<WeatherCollectorResult>,
) {
  const results: WeatherCollectorResult[] = Array.from({ length: contexts.length });
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < contexts.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await runCollector(contexts[index]!);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(weatherRefreshConcurrency, contexts.length) }, () => worker()),
  );
  return results;
}

if (process.argv[1]?.endsWith("collect-weather.ts")) {
  void runActiveWeatherCollectors().then((results) => {
    process.exitCode = results.some(({ exitCode }) => exitCode !== 0) ? 1 : 0;
  });
}

export {
  getActiveWeatherContexts,
  runActiveWeatherCollectors,
  runWeatherCollector,
  weatherRefreshConcurrency,
  type ActiveWeatherCollectorDependencies,
  type WeatherCollectorDependencies,
  type WeatherCollectorResult,
};
