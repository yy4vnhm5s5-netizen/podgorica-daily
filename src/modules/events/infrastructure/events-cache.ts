import {
  calculateCacheFreshness,
  readJsonCache,
  writeJsonCache,
} from "../../../shared/lib/cache.ts";
import { isIsoDate, isIsoTimestamp } from "../domain/event.ts";
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
      if (!cityId || !isCityId(cityId)) return [];
      const sanitized = sanitizeCachedEventDates({ ...event, cityId });
      if (!sanitized) {
        console.warn(
          JSON.stringify({
            cachePath,
            event: "event-cache-invalid-date-dropped",
            eventId: event.id,
            sourceId: event.sourceId,
          }),
        );
        return [];
      }
      return [sanitized];
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

// Normalization and the quality pipeline only validate an event's date fields at collection
// time; a cached snapshot is trusted verbatim on every subsequent read, with no re-validation.
// A record that predates today's validation rules (schema drift, an old retained snapshot, or
// any future provider regression) could otherwise carry a startsAt/startDate/endsAt value that
// no longer parses as a valid date and would crash date formatting wherever it's rendered. This
// re-applies the same isIsoTimestamp/isIsoDate checks normalization already uses, generically,
// for every provider and city — not just at write time.
function sanitizeCachedEventDates(event: CityEvent): CityEvent | undefined {
  const startsAt = isIsoTimestamp(event.startsAt) ? event.startsAt : undefined;
  const startDate = isIsoDate(event.startDate) ? event.startDate : undefined;
  if (!startsAt && !startDate) return undefined;

  return {
    ...event,
    endsAt: isIsoTimestamp(event.endsAt) ? event.endsAt : undefined,
    startDate,
    startsAt,
  };
}

async function writeEventCache(snapshot: EventCacheSnapshot, cachePath: string) {
  await writeJsonCache(snapshot, cachePath);
}

export { readEventCache, readEventCacheSnapshot, writeEventCache, type EventCacheSnapshot };
