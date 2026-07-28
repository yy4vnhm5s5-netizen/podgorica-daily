import { dirname } from "node:path";

import { acquireRefreshLock } from "../../../shared/lib/refresh-lock.ts";
import { createCityContext, getActiveCities, supportsCityCapability } from "@/shared/config/cities";
import type { City, CityContext, CityId } from "@/shared/types/city";

import {
  createPodgoricaFlightsHttpClient,
  getFlightsCachePath,
  isFlightsSupportedCityId,
  refreshPodgoricaFlights,
  type FlightsSupportedCityId,
  type PodgoricaFlightsRefreshResult,
} from "./podgorica-flights.ts";

interface PodgoricaFlightsCollectorDependencies {
  cachePath?: string;
  cityId?: FlightsSupportedCityId;
  refresh?: () => Promise<PodgoricaFlightsRefreshResult>;
  writeOutput?: (line: string) => void;
}

interface PodgoricaFlightsCollectorResult {
  cityId: string;
  exitCode: 0 | 1;
  output: string;
  refresh: PodgoricaFlightsRefreshResult | null;
  state: "already-running" | "failed" | "success";
}

interface ActiveFlightsCollectorDependencies {
  cities?: readonly City[];
  createContext?: (cityId: CityId) => CityContext;
  runCollector?: (context: CityContext) => Promise<PodgoricaFlightsCollectorResult>;
}

// Mirrors getActiveCedisContexts: only cities that are active, declare the "flights" capability,
// and have a verified Airports of Montenegro selector code are collected. Today that is Podgorica
// only — Tivat's code is not yet verified, so it has no "flights" capability and is excluded here
// automatically, the same way an unsupported CEDIS municipality is excluded there.
function getActiveFlightsContexts(
  cities: readonly City[] = getActiveCities(),
  createContext: (cityId: CityId) => CityContext = createCityContext,
) {
  return cities
    .filter(
      (city) =>
        city.isActive && supportsCityCapability(city, "flights") && isFlightsSupportedCityId(city.id),
    )
    .map((city) => createContext(city.id));
}

async function runPodgoricaFlightsCollector({
  cachePath,
  cityId = "podgorica",
  refresh,
  writeOutput = console.log,
}: PodgoricaFlightsCollectorDependencies = {}): Promise<PodgoricaFlightsCollectorResult> {
  const resolvedCachePath = cachePath ?? getFlightsCachePath(cityId);
  const lock = await acquireRefreshLock(dirname(resolvedCachePath), {
    lockFileName: `.podgorica-flights-refresh-${cityId}.lock`,
  });
  if (!("release" in lock)) {
    const output = [
      "provider=podgorica-airport",
      `cityId=${cityId}`,
      "state=already-running",
      "accepted=0",
      "cache=not-run",
      `cache_path=${resolvedCachePath}`,
    ].join(" ");
    writeOutput(output);
    return { cityId, exitCode: 0, output, refresh: null, state: "already-running" };
  }

  try {
    const result = await (
      refresh ??
      (() =>
        refreshPodgoricaFlights({
          cachePath: resolvedCachePath,
          cityId,
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
      `cityId=${cityId}`,
      `state=${state}`,
      `accepted=${result.acceptedFlights}`,
      `cache=${cache}`,
      `cache_path=${resolvedCachePath}`,
      ...(result.errorCode ? [`error=${result.errorCode}`] : []),
      ...(result.warnings[0] ? [`reason=${formatReason(result.warnings[0])}`] : []),
    ].join(" ");
    writeOutput(output);

    return { cityId, exitCode: result.success ? 0 : 1, output, refresh: result, state };
  } finally {
    await lock.release();
  }
}

async function runActiveFlightsCollectors({
  cities,
  createContext,
  runCollector = (context) =>
    runPodgoricaFlightsCollector({ cityId: context.city.id as FlightsSupportedCityId }),
}: ActiveFlightsCollectorDependencies = {}) {
  const results: PodgoricaFlightsCollectorResult[] = [];

  for (const context of getActiveFlightsContexts(cities, createContext)) {
    results.push(await runCollector(context));
  }

  return results;
}

function formatReason(value: string) {
  return value.replace(/\s+/g, "-").slice(0, 120);
}

if (process.argv[1]?.endsWith("collect-podgorica-flights.ts")) {
  void runActiveFlightsCollectors().then((results) => {
    process.exitCode = results.some(({ exitCode }) => exitCode !== 0) ? 1 : 0;
  });
}

export {
  getActiveFlightsContexts,
  runActiveFlightsCollectors,
  runPodgoricaFlightsCollector,
  type ActiveFlightsCollectorDependencies,
  type PodgoricaFlightsCollectorDependencies,
  type PodgoricaFlightsCollectorResult,
};
