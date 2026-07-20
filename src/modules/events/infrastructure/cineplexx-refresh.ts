import { normalizeEventCandidate } from "../domain/event-normalization.ts";
import { defaultEventQualityPolicy, runEventQualityPipeline } from "../domain/event-quality.ts";
import type { EventQualityPolicy } from "../domain/event-quality.ts";
import { writeEventCache, type EventCacheSnapshot } from "./events-cache.ts";
import {
  CineplexxBrowserError,
  inspectCineplexxRenderedDom,
  type CineplexxBrowserFailurePhase,
  type CineplexxBrowserRenderer,
} from "./cineplexx-browser-renderer.ts";
import { cineplexxProgrammeUrl, parseCineplexxProgramme } from "./cineplexx-programme-parser.ts";
import { emitError, emitInfo } from "./event-refresh-logger.ts";
import { logEventRefreshObservability, logEventRefreshParsedSample } from "./event-refresh-observability.ts";
import type { CityContext } from "@/shared/types/city";

type CineplexxRefreshPhase = CineplexxBrowserFailurePhase | "cache-write" | "normalization" | "parser";

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
  let phase: CineplexxRefreshPhase = "page-load";
  try {
    const refreshedAt = now();
    const html = await renderer.renderProgramme();
    phase = "parser";
    const candidates = parseCineplexxProgramme(html, {
      today: getPodgoricaDate(refreshedAt),
    });
    if (!candidates.length) {
      emitInfo({
        dom: inspectCineplexxRenderedDom(html, cineplexxProgrammeUrl),
        event: "cineplexx-refresh-zero-screenings",
        phase,
        provider: "cineplexx-podgorica",
        reason: "zero-screenings",
      });
    }
    logEventRefreshParsedSample({ candidates, provider: "cineplexx-podgorica" });
    phase = "normalization";
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
      const error = new CineplexxRefreshError("No valid Cineplexx screenings were collected.");
      logCineplexxRefreshFailure({ error, phase });
      return {
        lastRefreshError: error.message,
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
    phase = "cache-write";
    await writeCache(snapshot, cachePath);
    return { retainedPreviousSnapshot: false, snapshot, success: true };
  } catch (error) {
    logCineplexxRefreshFailure({ error, phase });
    return {
      lastRefreshError: "Cineplexx programme refresh failed.",
      retainedPreviousSnapshot: Boolean(previousSnapshot),
      snapshot: previousSnapshot ?? null,
      success: false,
    };
  }
}

class CineplexxRefreshError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CineplexxRefreshError";
  }
}

function logCineplexxRefreshFailure({
  error,
  phase,
}: {
  error: unknown;
  phase: CineplexxRefreshPhase;
}) {
  const exception = error instanceof Error ? error : new Error(String(error));
  const browserError = error instanceof CineplexxBrowserError ? error : undefined;
  emitError({
    chromiumExecutableMissing: browserError?.executableMissing ?? false,
    ...(browserError?.causeClass ? { causeClass: browserError.causeClass } : {}),
    ...(browserError?.causeMessage ? { causeMessage: browserError.causeMessage } : {}),
    ...(browserError?.domDiagnostics ? { dom: browserError.domDiagnostics } : {}),
    error: {
      class: exception.name,
      message: exception.message,
      ...(process.env.NODE_ENV === "development" ? { stack: exception.stack ?? "" } : {}),
    },
    event: "cineplexx-refresh-failed",
    phase: browserError?.phase ?? phase,
    provider: "cineplexx-podgorica",
  });
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

export {
  getPodgoricaDate,
  logCineplexxRefreshFailure,
  refreshCineplexxProgramme,
  type CineplexxRefreshResult,
  type CineplexxRefreshPhase,
};
