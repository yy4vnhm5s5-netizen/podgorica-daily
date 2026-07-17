import {
  calculateCacheFreshness,
  readJsonCache,
  writeJsonCache,
} from "../../../shared/lib/cache.ts";
import type { CityEvent, EventProviderResult, Venue } from "../domain/event.ts";
import type { CacheFreshnessStatus } from "@/shared/lib/cache";

interface EventCacheSnapshot {
  events: CityEvent[];
  fetchedAt: string;
  freshnessStatus: CacheFreshnessStatus;
  lastRefreshError?: string;
  lastSuccessfulRefreshAt: string;
  parserWarnings: string[];
  provider: {
    displayName: string;
    id: string;
    sourceUrl: string;
  };
  schemaVersion: 1;
  sourceUpdatedAt?: string;
  venues: Venue[];
}

async function readEventCache(
  cachePath: string,
  freshnessThresholdMinutes: number,
  now = new Date(),
): Promise<EventProviderResult> {
  const snapshot = await readJsonCache<EventCacheSnapshot>(cachePath);
  if (!snapshot || snapshot.schemaVersion !== 1) {
    return { events: [], parserWarnings: [], state: "unavailable", venues: [] };
  }

  const freshness = calculateCacheFreshness(
    new Date(snapshot.fetchedAt),
    now,
    freshnessThresholdMinutes,
  );
  return {
    events: snapshot.events,
    fetchedAt: snapshot.fetchedAt,
    lastRefreshError: snapshot.lastRefreshError,
    parserWarnings: snapshot.parserWarnings,
    sourceUpdatedAt: snapshot.sourceUpdatedAt,
    state: freshness === "fresh" ? "fresh" : "stale",
    venues: snapshot.venues,
  };
}

async function writeEventCache(snapshot: EventCacheSnapshot, cachePath: string) {
  await writeJsonCache(snapshot, cachePath);
}

export { readEventCache, writeEventCache, type EventCacheSnapshot };
