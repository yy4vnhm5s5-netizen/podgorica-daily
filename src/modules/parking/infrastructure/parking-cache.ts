import { env } from "@/config/env";
import { readJsonCache, writeJsonCache } from "@/shared/lib/cache";

import type {
  ParkingAvailabilitySnapshot,
  ParkingAvailabilityState,
} from "../domain/parking-availability.ts";
import {
  getParkingCatalogueLocation,
  parkingCityId,
  parkingProviderId,
} from "./parking-servis-podgorica.ts";

const defaultParkingCachePath = env.PARKING_CACHE_PATH;

interface ParkingCacheResult {
  snapshot?: ParkingAvailabilitySnapshot;
  state: "fresh" | "stale" | "unavailable";
}

function calculateParkingSnapshotState(
  fetchedAt: Date | undefined,
  now = new Date(),
  freshForMinutes = env.PARKING_CACHE_FRESHNESS_MINUTES,
  maxStaleMinutes = env.PARKING_CACHE_MAX_STALE_MINUTES,
): "fresh" | "stale" | "unavailable" {
  if (!fetchedAt || Number.isNaN(fetchedAt.getTime())) return "unavailable";
  const ageMinutes = (now.getTime() - fetchedAt.getTime()) / 60_000;
  if (ageMinutes <= freshForMinutes) return "fresh";
  return ageMinutes <= maxStaleMinutes ? "stale" : "unavailable";
}

function getParkingLocationAvailabilityState(
  sourceUpdatedAt: string | undefined,
  now = new Date(),
  freshForMinutes = env.PARKING_AVAILABILITY_FRESHNESS_MINUTES,
): ParkingAvailabilityState {
  if (!sourceUpdatedAt) return "unavailable";
  const updatedAt = new Date(sourceUpdatedAt);
  if (Number.isNaN(updatedAt.getTime())) return "unavailable";
  return now.getTime() - updatedAt.getTime() <= freshForMinutes * 60_000 ? "fresh" : "stale";
}

async function readParkingCache(
  cachePath = defaultParkingCachePath,
): Promise<ParkingAvailabilitySnapshot | null> {
  const snapshot = await readJsonCache<ParkingAvailabilitySnapshot>(cachePath);
  return isValidParkingAvailabilitySnapshot(snapshot) ? snapshot : null;
}

async function readParkingCacheResult(
  cachePath = defaultParkingCachePath,
  now = new Date(),
): Promise<ParkingCacheResult> {
  const snapshot = await readParkingCache(cachePath);
  if (!snapshot) return { state: "unavailable" };
  return { snapshot, state: calculateParkingSnapshotState(new Date(snapshot.fetchedAt), now) };
}

async function writeParkingCache(
  snapshot: ParkingAvailabilitySnapshot,
  cachePath = defaultParkingCachePath,
) {
  await writeJsonCache(snapshot, cachePath);
}

function isValidParkingAvailabilitySnapshot(value: unknown): value is ParkingAvailabilitySnapshot {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<ParkingAvailabilitySnapshot>;
  if (
    candidate.cityId !== parkingCityId ||
    typeof candidate.fetchedAt !== "string" ||
    typeof candidate.lastSuccessfulRefreshAt !== "string" ||
    !Array.isArray(candidate.locations) ||
    candidate.provider !== parkingProviderId ||
    candidate.schemaVersion !== 1 ||
    typeof candidate.sourceUrl !== "string"
  ) {
    return false;
  }

  const sourceIds = new Set<string>();
  return candidate.locations.every((location) => {
    if (typeof location !== "object" || location === null) return false;
    const record = location as Partial<ParkingAvailabilitySnapshot["locations"][number]>;
    if (
      typeof record.sourceId !== "string" ||
      typeof record.freeSpaces !== "number" ||
      !Number.isInteger(record.freeSpaces) ||
      record.freeSpaces < 0 ||
      typeof record.sourceUpdatedAt !== "string" ||
      sourceIds.has(record.sourceId)
    ) {
      return false;
    }
    sourceIds.add(record.sourceId);
    const catalogueLocation = getParkingCatalogueLocation(record.sourceId);
    return catalogueLocation !== undefined && record.freeSpaces <= catalogueLocation.capacity;
  });
}

export {
  calculateParkingSnapshotState,
  defaultParkingCachePath,
  getParkingLocationAvailabilityState,
  isValidParkingAvailabilitySnapshot,
  readParkingCache,
  readParkingCacheResult,
  writeParkingCache,
  type ParkingCacheResult,
};
