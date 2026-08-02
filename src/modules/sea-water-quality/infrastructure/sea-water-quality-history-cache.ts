import { dirname, join } from "node:path";

import { env } from "@/config/env";
import {
  calculateCacheFreshness,
  nodeFileSystem,
  readJsonCache,
  writeJsonCache,
  type CacheFileSystem,
  type CacheFreshnessStatus,
} from "@/shared/lib/cache";

import type {
  SeaWaterQualityHistory,
  SeaWaterQualityLocation,
  SeaWaterQualityMunicipality,
} from "../domain/sea-water-quality.ts";
import {
  getSeaWaterQualityMunicipality,
  type SeaWaterQualitySupportedCityId,
} from "./sea-water-quality-cities.ts";

interface SeaWaterQualityHistoryCacheSnapshot {
  fetchedAt: string;
  history: SeaWaterQualityHistory;
  lastSuccessfulRefreshAt: string;
  schemaVersion: 1;
  source: "Javno preduzeće za upravljanje morskim dobrom Crne Gore";
  sourceUrl: string;
}

interface SeaWaterQualityHistoryCacheResult {
  history?: SeaWaterQualityHistory;
  lastSuccessfulRefreshAt?: string;
  state: CacheFreshnessStatus;
}

const defaultSeaWaterQualityHistoryCachePath = join(
  dirname(env.SEA_WATER_QUALITY_CACHE_PATH),
  "budva-sea-water-quality-history.json",
);

function getSeaWaterQualityHistoryCachePath(cityId: SeaWaterQualitySupportedCityId) {
  return cityId === "budva"
    ? defaultSeaWaterQualityHistoryCachePath
    : join(
        dirname(defaultSeaWaterQualityHistoryCachePath),
        `${cityId}-sea-water-quality-history.json`,
      );
}

async function readSeaWaterQualityHistoryCache(
  cachePath = defaultSeaWaterQualityHistoryCachePath,
  fileSystem: CacheFileSystem = nodeFileSystem,
): Promise<SeaWaterQualityHistoryCacheSnapshot | null> {
  const snapshot = await readJsonCache<SeaWaterQualityHistoryCacheSnapshot>(cachePath, fileSystem);
  return isValidSnapshot(snapshot) ? snapshot : null;
}

async function writeSeaWaterQualityHistoryCache(
  snapshot: SeaWaterQualityHistoryCacheSnapshot,
  cachePath = defaultSeaWaterQualityHistoryCachePath,
  fileSystem: CacheFileSystem = nodeFileSystem,
) {
  await writeJsonCache(snapshot, cachePath, fileSystem);
}

async function getCachedSeaWaterQualityHistory(
  cachePath = defaultSeaWaterQualityHistoryCachePath,
  now = new Date(),
): Promise<SeaWaterQualityHistoryCacheResult> {
  const snapshot = await readSeaWaterQualityHistoryCache(cachePath);
  if (!snapshot) return { state: "unavailable" };

  return {
    history: snapshot.history,
    lastSuccessfulRefreshAt: snapshot.lastSuccessfulRefreshAt,
    state: calculateCacheFreshness(
      new Date(snapshot.fetchedAt),
      now,
      env.SEA_WATER_QUALITY_CACHE_FRESHNESS_MINUTES,
    ),
  };
}

function mergeSeaWaterQualityHistory({
  cityId,
  previous,
  round,
  summaryLocations,
  year,
}: {
  cityId: SeaWaterQualitySupportedCityId;
  previous?: SeaWaterQualityHistory;
  round: number;
  summaryLocations: readonly SeaWaterQualityLocation[];
  year: number;
}): SeaWaterQualityHistory {
  const municipality = cityId as SeaWaterQualityMunicipality;
  const sourceMunicipalityId = getSeaWaterQualityMunicipality(cityId)!.municipalityId;
  // History is deliberately season-bounded. A new calendar year starts a fresh local history
  // snapshot instead of turning this file into an unbounded archive.
  const sameSeasonPrevious = previous?.year === year ? previous : undefined;
  const previousBySourceId = new Map(
    sameSeasonPrevious?.locations.map((location) => [location.sourceLocationId, location]) ?? [],
  );
  const usedSlugs = new Set(
    sameSeasonPrevious?.locations.map((location) => location.canonicalSlug) ?? [],
  );
  const currentSourceIds = new Set(summaryLocations.map((location) => location.id));
  const nextLocations = summaryLocations.map((location) => {
    const existing = previousBySourceId.get(location.id);
    const measurement = {
      grade: location.grade,
      ...(location.samplingDate ? { samplingDate: location.samplingDate } : {}),
      ...(location.samplingDateTime ? { samplingDateTime: location.samplingDateTime } : {}),
      sourceRound: round,
    };
    const priorMeasurements =
      existing?.measurements.filter((candidate) => candidate.sourceRound !== round) ?? [];

    return {
      ...(location.beachName ? { beachName: location.beachName } : {}),
      canonicalSlug:
        existing?.canonicalSlug ?? createCanonicalSlug(location.name, location.id, usedSlugs),
      displayName: location.name,
      firstSeenRound: existing?.firstSeenRound ?? round,
      lastSeenRound: round,
      measurements: [...priorMeasurements, measurement].sort(
        (left, right) => left.sourceRound - right.sourceRound,
      ),
      presentInLatestRound: true,
      sourceLocationId: location.id,
    };
  });
  const absentLocations = (sameSeasonPrevious?.locations ?? [])
    .filter((location) => !currentSourceIds.has(location.sourceLocationId))
    .map((location) => ({ ...location, presentInLatestRound: false }));

  return {
    latestRound: round,
    locations: [...nextLocations, ...absentLocations].sort((left, right) =>
      left.displayName.localeCompare(right.displayName, "sr-Latn-ME"),
    ),
    municipality,
    sourceMunicipalityId,
    year,
  };
}

function createCanonicalSlug(name: string, sourceLocationId: number, usedSlugs: Set<string>) {
  const base =
    name
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLocaleLowerCase("sr-Latn-ME")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "kupalište";
  const slug = usedSlugs.has(base) ? `${base}-${sourceLocationId}` : base;
  usedSlugs.add(slug);
  return slug;
}

function isValidSnapshot(value: unknown): value is SeaWaterQualityHistoryCacheSnapshot {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<SeaWaterQualityHistoryCacheSnapshot>;
  return (
    typeof candidate.fetchedAt === "string" &&
    typeof candidate.lastSuccessfulRefreshAt === "string" &&
    candidate.schemaVersion === 1 &&
    typeof candidate.history === "object" &&
    candidate.history !== null
  );
}

export {
  createCanonicalSlug,
  defaultSeaWaterQualityHistoryCachePath,
  getCachedSeaWaterQualityHistory,
  getSeaWaterQualityHistoryCachePath,
  mergeSeaWaterQualityHistory,
  readSeaWaterQualityHistoryCache,
  writeSeaWaterQualityHistoryCache,
  type SeaWaterQualityHistoryCacheResult,
  type SeaWaterQualityHistoryCacheSnapshot,
};
