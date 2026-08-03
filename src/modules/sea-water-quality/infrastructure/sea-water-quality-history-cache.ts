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
  SeaWaterQualityHistoryLocation,
  SeaWaterQualityHistoryMeasurement,
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

    return {
      ...(location.beachName ? { beachName: location.beachName } : {}),
      canonicalSlug:
        existing?.canonicalSlug ?? createCanonicalSlug(location.name, location.id, usedSlugs),
      displayName: location.name,
      firstSeenRound: existing?.firstSeenRound ?? round,
      lastSeenRound: round,
      measurements: upsertHistoryMeasurement(
        existing?.measurements ?? [],
        createHistoryMeasurement(location, round),
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
    locations: sortHistoryLocations([...nextLocations, ...absentLocations]),
    municipality,
    sourceMunicipalityId,
    year,
  };
}

// Backfill of an OLDER, already-completed round. Deliberately a separate function rather than a
// mode flag on mergeSeaWaterQualityHistory: the current-round merge owns every "latest" fact
// (latestRound, lastSeenRound, presentInLatestRound, displayName, and the absent-location pass),
// and an older round must never be able to restate any of them. This function therefore only ever
// adds (or corrects) one measurement per location and lowers firstSeenRound — it cannot downgrade
// newer metadata, cannot mark a location absent, and cannot remove anything.
function mergeSeaWaterQualityHistoryBackfill({
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
  // Season-bounded exactly like the current merge: history from another year is never a base for
  // this year's backfill. The runner refuses the write outright when a *newer* season is present,
  // so a stale backfill request cannot replace newer history.
  const sameSeasonPrevious = previous?.year === year ? previous : undefined;
  const previousBySourceId = new Map(
    sameSeasonPrevious?.locations.map((location) => [location.sourceLocationId, location]) ?? [],
  );
  const usedSlugs = new Set(
    sameSeasonPrevious?.locations.map((location) => location.canonicalSlug) ?? [],
  );

  const backfilledSourceIds = new Set(summaryLocations.map((location) => location.id));
  const mergedLocations: SeaWaterQualityHistoryLocation[] = summaryLocations.map((location) => {
    const existing = previousBySourceId.get(location.id);
    const measurement = createHistoryMeasurement(location, round);

    // Not seen this season yet: the historical round is genuinely all we know about it. It is
    // explicitly NOT present in the latest round — only a current-round refresh may assert that.
    if (!existing) {
      return {
        ...(location.beachName ? { beachName: location.beachName } : {}),
        canonicalSlug: createCanonicalSlug(location.name, location.id, usedSlugs),
        displayName: location.name,
        firstSeenRound: round,
        lastSeenRound: round,
        measurements: [measurement],
        presentInLatestRound: false,
        sourceLocationId: location.id,
      };
    }

    return {
      ...existing,
      // The only metadata an older round may move, and only ever backwards.
      firstSeenRound: Math.min(existing.firstSeenRound, round),
      measurements: upsertHistoryMeasurement(existing.measurements, measurement),
    };
  });
  const untouchedLocations = (sameSeasonPrevious?.locations ?? []).filter(
    (location) => !backfilledSourceIds.has(location.sourceLocationId),
  );

  return {
    // Never downgrade: an older round cannot become the latest one.
    latestRound: Math.max(sameSeasonPrevious?.latestRound ?? round, round),
    locations: sortHistoryLocations([...mergedLocations, ...untouchedLocations]),
    municipality,
    sourceMunicipalityId,
    year,
  };
}

function createHistoryMeasurement(
  location: SeaWaterQualityLocation,
  round: number,
): SeaWaterQualityHistoryMeasurement {
  return {
    grade: location.grade,
    ...(location.samplingDate ? { samplingDate: location.samplingDate } : {}),
    ...(location.samplingDateTime ? { samplingDateTime: location.samplingDateTime } : {}),
    sourceRound: round,
  };
}

// Upsert by sourceRound: re-ingesting a round replaces its measurement instead of appending a
// duplicate, so a rerun is idempotent and a corrected JPMD grade overwrites the stored one.
// Ordering key is sourceRound, which is the officially chronological axis (calendar 2026:
// R1 25.05 → R2 08.06 → R3 22.06 → R4 06.07 → R5 20.07) and, unlike sampling date, is always
// present and yields a strictly transitive comparator. Sampling dates stay on each measurement
// for display.
function upsertHistoryMeasurement(
  existing: readonly SeaWaterQualityHistoryMeasurement[],
  measurement: SeaWaterQualityHistoryMeasurement,
): SeaWaterQualityHistoryMeasurement[] {
  return [
    ...existing.filter((candidate) => candidate.sourceRound !== measurement.sourceRound),
    measurement,
  ].sort((left, right) => left.sourceRound - right.sourceRound);
}

function sortHistoryLocations(locations: readonly SeaWaterQualityHistoryLocation[]) {
  return [...locations].sort(
    (left, right) =>
      left.displayName.localeCompare(right.displayName, "sr-Latn-ME") ||
      left.sourceLocationId - right.sourceLocationId,
  );
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
  mergeSeaWaterQualityHistoryBackfill,
  readSeaWaterQualityHistoryCache,
  writeSeaWaterQualityHistoryCache,
  type SeaWaterQualityHistoryCacheResult,
  type SeaWaterQualityHistoryCacheSnapshot,
};
