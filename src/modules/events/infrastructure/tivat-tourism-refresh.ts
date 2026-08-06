import { getEventQualityPolicy } from "../../../config/event-quality.ts";
import type { EventCandidate } from "../domain/event.ts";
import { normalizeEventCandidate } from "../domain/event-normalization.ts";
import { isEventWithinQualityWindow, runEventQualityPipeline } from "../domain/event-quality.ts";
import { writeEventCache, type EventCacheSnapshot } from "./events-cache.ts";
import { emitInfo } from "./event-refresh-logger.ts";
import {
  logEventRefreshObservability,
  logEventRefreshParsedSample,
} from "./event-refresh-observability.ts";
import { parseTivatTourismEventDetail } from "./tivat-tourism-detail-parser.ts";
import type { TivatTourismHttpClient } from "./tivat-tourism-http-client.ts";
import {
  extractTivatTourismPageCount,
  getTivatTourismPageUrl,
  parseTivatTourismEventCards,
  tivatTourismCalendarUrl,
} from "./tivat-tourism-event-parser.ts";
import type { CityContext } from "@/shared/types/city";

// The listing card carries only a title, a date and an image. Everything else the organiser
// publishes — the place and the description — lives on the event's own page, so each candidate's
// own sourceUrl is fetched once. Candidates are already deduplicated by sourceUrl above, so a
// page is never requested twice in one run. Enrichment is strictly additive: a failed or
// unparseable detail page leaves the listing-derived event exactly as it was.
const detailFetchConcurrency = 3;

// The Tivat calendar keeps years of past events on its later pages. Fetching a detail page for an
// event the platform is going to discard anyway is wasted load on the organiser's site, so the
// enrichment set is the platform's own quality window — the same rule the pipeline enforces a few
// lines further down, not a second date policy invented here. Everything else is still collected
// exactly as before; it simply keeps the listing-derived fields.
async function enrichTivatTourismCandidates(
  candidates: readonly EventCandidate[],
  httpClient: TivatTourismHttpClient,
  now: Date,
) {
  const policy = getEventQualityPolicy();
  const enrichable = candidates.filter((candidate) =>
    isEventWithinQualityWindow(
      { startDate: candidate.startDate, startsAt: candidate.startsAt },
      policy,
      now,
    ),
  );

  const bySourceUrl = new Map<string, EventCandidate>();
  for (let index = 0; index < enrichable.length; index += detailFetchConcurrency) {
    const batch = enrichable.slice(index, index + detailFetchConcurrency);
    const results = await Promise.all(
      batch.map((candidate) => enrichTivatTourismCandidate(candidate, httpClient)),
    );
    for (const result of results) bySourceUrl.set(result.source.sourceUrl, result);
  }

  return candidates.map((candidate) => bySourceUrl.get(candidate.source.sourceUrl) ?? candidate);
}

async function enrichTivatTourismCandidate(
  candidate: EventCandidate,
  httpClient: TivatTourismHttpClient,
): Promise<EventCandidate> {
  const detailUrl = candidate.source.sourceUrl;
  let detail;
  try {
    detail = parseTivatTourismEventDetail(await httpClient.get(detailUrl));
  } catch {
    emitInfo({
      event: "events-refresh-rejected-event",
      provider: "tourism-tivat",
      reasons: ["other"],
      sourceUrl: detailUrl,
    });
    return {
      ...candidate,
      parserWarnings: [
        ...(candidate.parserWarnings ?? []),
        "Tivat Tourism event detail page was unavailable.",
      ],
    };
  }

  // Each field stands on its own: a page may state a place and no prose, or prose and no place.
  return {
    ...candidate,
    ...(detail.description ? { rawDescription: detail.description } : {}),
    ...(detail.venueName ? { rawVenue: detail.venueName } : {}),
  };
}

interface TivatTourismRefreshResult {
  fetchedPageCount: number;
  lastRefreshError?: string;
  retainedPreviousSnapshot: boolean;
  snapshot: EventCacheSnapshot | null;
  success: boolean;
}

async function refreshTivatTourismEvents({
  cachePath,
  context,
  httpClient,
  now = () => new Date(),
  previousSnapshot,
  writeCache = writeEventCache,
}: {
  cachePath: string;
  context: CityContext;
  httpClient: TivatTourismHttpClient;
  now?: () => Date;
  previousSnapshot?: EventCacheSnapshot | null;
  writeCache?: (snapshot: EventCacheSnapshot, path: string) => Promise<void>;
}): Promise<TivatTourismRefreshResult> {
  let fetchedPageCount = 0;
  try {
    const firstPageHtml = await httpClient.get(tivatTourismCalendarUrl);
    fetchedPageCount++;
    const pageCount = extractTivatTourismPageCount(firstPageHtml);

    const remainingPagesHtml = await Promise.all(
      Array.from({ length: Math.max(0, pageCount - 1) }, (_unused, index) => index + 2).map(
        async (pageNumber) => {
          try {
            const html = await httpClient.get(getTivatTourismPageUrl(pageNumber));
            fetchedPageCount++;
            return html;
          } catch {
            emitInfo({
              event: "events-refresh-rejected-event",
              provider: "tourism-tivat",
              reasons: ["other"],
              sourceUrl: getTivatTourismPageUrl(pageNumber),
            });
            return null;
          }
        },
      ),
    );

    const candidates = [firstPageHtml, ...remainingPagesHtml]
      .flatMap((html) => (html ? parseTivatTourismEventCards(html).candidates : []))
      .filter(
        (candidate, index, all) =>
          all.findIndex((other) => other.source.sourceUrl === candidate.source.sourceUrl) ===
          index,
      );
    const enrichedCandidates = await enrichTivatTourismCandidates(candidates, httpClient, now());
    logEventRefreshParsedSample({ candidates: enrichedCandidates, provider: "tourism-tivat" });

    const normalized = enrichedCandidates.map((candidate) =>
      normalizeEventCandidate(candidate, context, now()),
    );
    const quality = runEventQualityPipeline({
      candidatesDiscovered: enrichedCandidates.length,
      events: normalized.flatMap(({ event }) => (event ? [event] : [])),
      now: now(),
      policy: getEventQualityPolicy(),
      previousSuccessfulEventCount: previousSnapshot?.events.length,
      validCityIds: [context.city.id],
    });
    logEventRefreshObservability({
      candidates: enrichedCandidates,
      fetchedCount: enrichedCandidates.length,
      normalized,
      parsedCount: enrichedCandidates.length,
      provider: "tourism-tivat",
      quality,
    });

    if (!quality.finalEvents.length && previousSnapshot?.events.length)
      return {
        fetchedPageCount,
        lastRefreshError: "No valid Tivat Tourism events were collected.",
        retainedPreviousSnapshot: true,
        snapshot: previousSnapshot,
        success: false,
      };

    const timestamp = now().toISOString();
    const snapshot: EventCacheSnapshot = {
      events: quality.finalEvents,
      fetchedAt: timestamp,
      freshnessStatus: "fresh",
      lastSuccessfulRefreshAt: timestamp,
      parserWarnings: enrichedCandidates.flatMap((candidate) => candidate.parserWarnings ?? []),
      provider: {
        displayName: "Turistička organizacija Tivat events",
        id: "tourism-tivat",
        sourceUrl: tivatTourismCalendarUrl,
      },
      qualityDiagnostics: quality.diagnostics,
      rejectedEventIds: quality.rejected.flatMap(({ eventId }) => (eventId ? [eventId] : [])),
      schemaVersion: 2,
      venues: [],
    };
    await writeCache(snapshot, cachePath);
    return { fetchedPageCount, retainedPreviousSnapshot: false, snapshot, success: true };
  } catch {
    return {
      fetchedPageCount,
      lastRefreshError: "Tivat Tourism refresh failed.",
      retainedPreviousSnapshot: Boolean(previousSnapshot),
      snapshot: previousSnapshot ?? null,
      success: false,
    };
  }
}
export { refreshTivatTourismEvents, type TivatTourismRefreshResult };
