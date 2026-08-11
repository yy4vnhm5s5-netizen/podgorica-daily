import { dirname } from "node:path";

import { env } from "@/config/env";
import { createCityContext, getActiveCities, supportsCityCapability } from "@/shared/config/cities";
import { acquireRefreshLock } from "@/shared/lib/refresh-lock";
import type { City, CityContext } from "@/shared/types/city";

import { calculateParkingSnapshotState, defaultParkingCachePath } from "./parking-cache.ts";
import { parkingCityId, parkingProviderId } from "./parking-servis-podgorica.ts";
import { refreshParkingAvailability, type ParkingRefreshResult } from "./parking-refresh.ts";

interface ParkingCollectorResult {
  cityId: typeof parkingCityId;
  exitCode: 0 | 1;
  output: string;
  refresh: ParkingRefreshResult | null;
  snapshotState: "fresh" | "stale" | "unavailable" | "not-run";
  state: "already-running" | "failed" | "success";
}

interface ActiveParkingCollectorDependencies {
  cities?: readonly City[];
  enabled?: boolean;
  runCollector?: (context: CityContext) => Promise<ParkingCollectorResult>;
}

function getActiveParkingContexts(cities: readonly City[] = getActiveCities()) {
  return cities
    .filter(
      (city) =>
        city.isActive && city.id === parkingCityId && supportsCityCapability(city, "parking"),
    )
    .map((city) => createCityContext(city.id));
}

async function runParkingAvailabilityCollector({
  cachePath = defaultParkingCachePath,
  refresh = () => refreshParkingAvailability({ cachePath }),
  writeOutput = console.log,
}: {
  cachePath?: string;
  refresh?: () => Promise<ParkingRefreshResult>;
  writeOutput?: (line: string) => void;
} = {}): Promise<ParkingCollectorResult> {
  const lock = await acquireRefreshLock(dirname(cachePath), {
    lockFileName: ".parking-availability-refresh.lock",
  });
  if (!("release" in lock)) {
    const output = [
      `provider=${parkingProviderId}`,
      `cityId=${parkingCityId}`,
      "state=already-running",
      "accepted=0",
      "cache=not-run",
    ].join(" ");
    writeOutput(output);
    return {
      cityId: parkingCityId,
      exitCode: 0,
      output,
      refresh: null,
      snapshotState: "not-run",
      state: "already-running",
    };
  }

  try {
    const result = await refresh();
    const snapshotState = result.snapshot
      ? calculateParkingSnapshotState(new Date(result.snapshot.fetchedAt))
      : "unavailable";
    const state = result.success ? "success" : "failed";
    const output = [
      `provider=${parkingProviderId}`,
      `cityId=${parkingCityId}`,
      `state=${state}`,
      `accepted=${result.acceptedLocations}`,
      `cache=${result.success ? "written" : result.retainedPreviousSnapshot ? "retained" : "unavailable"}`,
      ...(result.errorCode ? [`error=${result.errorCode}`] : []),
      ...(result.warnings.length > 0 ? [`warnings=${result.warnings.join(",")}`] : []),
    ].join(" ");
    writeOutput(output);
    return {
      cityId: parkingCityId,
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

async function runActiveParkingCollectors({
  cities,
  enabled = env.ENABLE_PARKING,
  runCollector = () => runParkingAvailabilityCollector(),
}: ActiveParkingCollectorDependencies = {}) {
  if (!enabled) return [];
  const contexts = getActiveParkingContexts(cities);
  const results: ParkingCollectorResult[] = [];
  for (const context of contexts) results.push(await runCollector(context));
  return results;
}

if (process.argv[1]?.endsWith("collect-parking-availability.ts")) {
  void runActiveParkingCollectors().then((results) => {
    process.exitCode = results.some(({ exitCode }) => exitCode !== 0) ? 1 : 0;
  });
}

export {
  getActiveParkingContexts,
  runActiveParkingCollectors,
  runParkingAvailabilityCollector,
  type ParkingCollectorResult,
};
