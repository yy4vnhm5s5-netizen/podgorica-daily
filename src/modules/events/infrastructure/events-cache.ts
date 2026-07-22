import {
  calculateCacheFreshness,
  readJsonCache,
  writeJsonCache,
} from "../../../shared/lib/cache.ts";
import type { CityEvent, EventProviderResult, Venue } from "../domain/event.ts";
import type { EventQualityDiagnostics } from "../domain/event-quality.ts";
import type { CacheFreshnessStatus } from "@/shared/lib/cache";
import { isCityId } from "@/shared/config/cities";

interface EventCacheSnapshot {
  events: CityEvent[];
  fetchedAt: string;
  freshnessStatus: CacheFreshnessStatus;
  lastRefreshError?: string;
  lastSuccessfulRefreshAt: string;
  qualityDiagnostics?: EventQualityDiagnostics;
  parserWarnings: string[];
  provider: {
    displayName: string;
    id: string;
    sourceUrl: string;
  };
  rejectedEventIds?: string[];
  schemaVersion: 1 | 2;
  sourceUpdatedAt?: string;
  venues: Venue[];
}

async function readEventCache(
  cachePath: string,
  freshnessThresholdMinutes: number,
  now = new Date(),
): Promise<EventProviderResult> {
  const snapshot = await readEventCacheSnapshot(cachePath);
  if (!snapshot) {
    return { events: [], parserWarnings: [], state: "unavailable", venues: [] };
  }

  const freshness = calculateCacheFreshness(
    new Date(snapshot.fetchedAt),
    now,
    freshnessThresholdMinutes,
  );
  return {
    events: snapshot.events.filter((event) => !snapshot.rejectedEventIds?.includes(event.id)),
    fetchedAt: snapshot.fetchedAt,
    lastRefreshError: snapshot.lastRefreshError,
    parserWarnings: snapshot.parserWarnings,
    qualityDiagnostics: snapshot.qualityDiagnostics,
    sourceUpdatedAt: snapshot.sourceUpdatedAt,
    state: freshness === "fresh" ? "fresh" : "stale",
    venues: snapshot.venues,
  };
}

async function readEventCacheSnapshot(cachePath: string) {
  const snapshot = await readJsonCache<EventCacheSnapshot>(cachePath);
  if (!snapshot || (snapshot.schemaVersion !== 1 && snapshot.schemaVersion !== 2)) return null;

  return {
    ...snapshot,
    events: snapshot.events.flatMap((event) => {
      const cityId = resolveCachedEventCityId(event);
      return cityId && isCityId(cityId) ? [{ ...event, cityId }] : [];
    }),
  };
}

function resolveCachedEventCityId(event: CityEvent) {
  if (isCityId(event.cityId)) return event.cityId;

  const cityIds = Array.isArray(event.cityIds)
    ? [...new Set(event.cityIds.filter((cityId) => isCityId(cityId)))]
    : [];

  return cityIds.length === 1 ? cityIds[0] : undefined;
}

async function writeEventCache(snapshot: EventCacheSnapshot, cachePath: string) {
  await writeJsonCache(snapshot, cachePath);
}

export { readEventCache, readEventCacheSnapshot, writeEventCache, type EventCacheSnapshot };
