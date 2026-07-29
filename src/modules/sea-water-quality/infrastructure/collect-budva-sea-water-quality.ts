import { dirname } from "node:path";

import { acquireRefreshLock } from "../../../shared/lib/refresh-lock.ts";
import { createCityContext, getActiveCities, supportsCityCapability } from "@/shared/config/cities";
import type { City, CityContext, CityId } from "@/shared/types/city";

import { getSeaWaterQualityCachePath } from "./budva-sea-water-quality-cache.ts";
import {
  refreshBudvaSeaWaterQuality,
  type BudvaSeaWaterQualityRefreshResult,
} from "./budva-sea-water-quality-refresh.ts";
import { createMorskodobroHttpClient } from "./morskodobro-http-client.ts";
import {
  getSeaWaterQualityCityId,
  type SeaWaterQualitySupportedCityId,
} from "./sea-water-quality-cities.ts";

interface BudvaSeaWaterQualityCollectorDependencies {
  cachePath?: string;
  cityId?: SeaWaterQualitySupportedCityId;
  refresh?: () => Promise<BudvaSeaWaterQualityRefreshResult>;
  writeOutput?: (line: string) => void;
}

interface ActiveSeaWaterQualityCollectorDependencies {
  cities?: readonly City[];
  createContext?: (cityId: CityId) => CityContext;
  runCollector?: (
    cityId: SeaWaterQualitySupportedCityId,
  ) => Promise<BudvaSeaWaterQualityCollectorResult>;
}

interface BudvaSeaWaterQualityCollectorResult {
  cityId: SeaWaterQualitySupportedCityId;
  exitCode: 0 | 1;
  output: string;
  refresh: BudvaSeaWaterQualityRefreshResult | null;
  state: "already-running" | "failed" | "success";
}

async function runBudvaSeaWaterQualityCollector({
  cityId = "budva",
  cachePath = getSeaWaterQualityCachePath(cityId),
  refresh,
  writeOutput = console.log,
}: BudvaSeaWaterQualityCollectorDependencies = {}): Promise<BudvaSeaWaterQualityCollectorResult> {
  const lock = await acquireRefreshLock(dirname(cachePath), {
    lockFileName: `.${cityId}-sea-water-quality-refresh.lock`,
  });
  if (!("release" in lock)) {
    const output = [
      "provider=sea-water-quality",
      `city=${cityId}`,
      "state=already-running",
      "accepted=0",
      "cache=not-run",
      `cache_path=${cachePath}`,
    ].join(" ");
    writeOutput(output);
    return { cityId, exitCode: 0, output, refresh: null, state: "already-running" };
  }

  try {
    const result = await (
      refresh ??
      (() =>
        refreshBudvaSeaWaterQuality({
          cachePath,
          cityId,
          httpClient: createMorskodobroHttpClient(),
        }))
    )();
    const state = result.success ? "success" : "failed";
    const cache = result.success
      ? "written"
      : result.retainedPreviousSnapshot
        ? "retained"
        : "unavailable";
    const output = [
      "provider=sea-water-quality",
      `city=${cityId}`,
      `state=${state}`,
      `accepted=${result.totalLocations}`,
      `cache=${cache}`,
      `cache_path=${cachePath}`,
      ...(result.errorCode ? [`error=${result.errorCode}`] : []),
      ...(result.warnings[0] ? [`reason=${formatReason(result.warnings[0])}`] : []),
    ].join(" ");
    writeOutput(output);

    return { cityId, exitCode: result.success ? 0 : 1, output, refresh: result, state };
  } finally {
    await lock.release();
  }
}

function getActiveSeaWaterQualityContexts(
  cities: readonly City[] = getActiveCities(),
  createContext: (cityId: CityId) => CityContext = createCityContext,
) {
  return cities
    .filter(
      (city) =>
        city.isActive &&
        supportsCityCapability(city, "seaWaterQuality") &&
        Boolean(getSeaWaterQualityCityId(city.id)),
    )
    .map((city) => createContext(city.id));
}

// One collector run per active, supported city — matches the CEDIS/MonteGigs multi-city
// convention. Each city has its own lock file, so a slow/stuck city cannot block the others.
async function runActiveSeaWaterQualityCollectors({
  cities,
  createContext,
  runCollector = (cityId) => runBudvaSeaWaterQualityCollector({ cityId }),
}: ActiveSeaWaterQualityCollectorDependencies = {}): Promise<BudvaSeaWaterQualityCollectorResult[]> {
  const results: BudvaSeaWaterQualityCollectorResult[] = [];
  for (const context of getActiveSeaWaterQualityContexts(cities, createContext)) {
    const cityId = getSeaWaterQualityCityId(context);
    if (!cityId) continue;
    results.push(await runCollector(cityId));
  }
  return results;
}

function formatReason(value: string) {
  return value.replace(/\s+/g, "-").slice(0, 120);
}

if (process.argv[1]?.endsWith("collect-budva-sea-water-quality.ts")) {
  void runActiveSeaWaterQualityCollectors().then((results) => {
    process.exitCode = results.some(({ exitCode }) => exitCode !== 0) ? 1 : 0;
  });
}

export {
  getActiveSeaWaterQualityContexts,
  runActiveSeaWaterQualityCollectors,
  runBudvaSeaWaterQualityCollector,
  type ActiveSeaWaterQualityCollectorDependencies,
  type BudvaSeaWaterQualityCollectorDependencies,
  type BudvaSeaWaterQualityCollectorResult,
};
