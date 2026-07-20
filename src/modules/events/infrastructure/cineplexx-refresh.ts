import { normalizeEventCandidate } from "../domain/event-normalization.ts";
import { defaultEventQualityPolicy, runEventQualityPipeline } from "../domain/event-quality.ts";
import type { EventQualityPolicy } from "../domain/event-quality.ts";
import { writeEventCache, type EventCacheSnapshot } from "./events-cache.ts";
import type { CineplexxBrowserRenderer } from "./cineplexx-browser-renderer.ts";
import { cineplexxProgrammeUrl, parseCineplexxProgramme } from "./cineplexx-programme-parser.ts";
import { logEventRefreshObservability, logEventRefreshParsedSample } from "./event-refresh-observability.ts";
import type { CityContext } from "@/shared/types/city";

interface CineplexxRefreshResult {
  lastRefreshError?: string;
  retainedPreviousSnapshot: boolean;
  snapshot: EventCacheSnapshot | null;
  success: boolean;
}

async function refreshCineplexxProgramme({
  cachePath,
  context,
  now = () => new Date(),
  previousSnapshot,
  qualityPolicy = defaultEventQualityPolicy,
  renderer,
  writeCache = writeEventCache,
}: {
  cachePath: string;
  context: CityContext;
  now?: () => Date;
  previousSnapshot?: EventCacheSnapshot | null;
  qualityPolicy?: EventQualityPolicy;
  renderer: CineplexxBrowserRenderer;
  writeCache?: (snapshot: EventCacheSnapshot, path: string) => Promise<void>;
}): Promise<CineplexxRefreshResult> {
  try {
    const refreshedAt = now();
    const candidates = parseCineplexxProgramme(await renderer.renderProgramme(), {
      today: getPodgoricaDate(refreshedAt),
    });
    logEventRefreshParsedSample({ candidates, provider: "cineplexx-podgorica" });
    const normalized = candidates.map((candidate) =>
      normalizeEventCandidate(candidate, context, refreshedAt),
    );
    const quality = runEventQualityPipeline({
      candidatesDiscovered: candidates.length,
      events: normalized.flatMap(({ event }) => (event ? [event] : [])),
      now: refreshedAt,
      policy: qualityPolicy,
      previousSuccessfulEventCount: previousSnapshot?.events.length,
      validCityIds: [context.city.id],
    });
    logEventRefreshObservability({
      candidates,
      fetchedCount: 1,
      normalized,
      parsedCount: candidates.length,
      provider: "cineplexx-podgorica",
      quality,
    });

    if (!quality.finalEvents.length && previousSnapshot?.events.length) {
      return {
        lastRefreshError: "No valid Cineplexx screenings were collected.",
        retainedPreviousSnapshot: true,
        snapshot: previousSnapshot,
        success: false,
      };
    }

    const timestamp = refreshedAt.toISOString();
    const snapshot: EventCacheSnapshot = {
      events: quality.finalEvents,
      fetchedAt: timestamp,
      freshnessStatus: "fresh",
      lastSuccessfulRefreshAt: timestamp,
      parserWarnings: candidates.flatMap((candidate) => candidate.parserWarnings),
      provider: {
        displayName: "Cineplexx Podgorica programme",
        id: "cineplexx-podgorica",
        sourceUrl: cineplexxProgrammeUrl,
      },
      qualityDiagnostics: quality.diagnostics,
      rejectedEventIds: quality.rejected.flatMap(({ eventId }) => (eventId ? [eventId] : [])),
      schemaVersion: 2,
      venues: [],
    };
    await writeCache(snapshot, cachePath);
    return { retainedPreviousSnapshot: false, snapshot, success: true };
  } catch {
    return {
      lastRefreshError: "Cineplexx programme refresh failed.",
      retainedPreviousSnapshot: Boolean(previousSnapshot),
      snapshot: previousSnapshot ?? null,
      success: false,
    };
  }
}

function getPodgoricaDate(value: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Europe/Podgorica",
    year: "numeric",
  }).formatToParts(value);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export { getPodgoricaDate, refreshCineplexxProgramme, type CineplexxRefreshResult };
