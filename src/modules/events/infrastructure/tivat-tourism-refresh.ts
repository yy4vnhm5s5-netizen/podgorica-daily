import { getEventQualityPolicy } from "../../../config/event-quality.ts";
import { normalizeEventCandidate } from "../domain/event-normalization.ts";
import { runEventQualityPipeline } from "../domain/event-quality.ts";
import { writeEventCache, type EventCacheSnapshot } from "./events-cache.ts";
import { emitInfo } from "./event-refresh-logger.ts";
import {
  logEventRefreshObservability,
  logEventRefreshParsedSample,
} from "./event-refresh-observability.ts";
import type { TivatTourismHttpClient } from "./tivat-tourism-http-client.ts";
import {
  extractTivatTourismPageCount,
  getTivatTourismPageUrl,
  parseTivatTourismEventCards,
  tivatTourismCalendarUrl,
} from "./tivat-tourism-event-parser.ts";
import type { CityContext } from "@/shared/types/city";

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
    logEventRefreshParsedSample({ candidates, provider: "tourism-tivat" });

    const normalized = candidates.map((candidate) =>
      normalizeEventCandidate(candidate, context, now()),
    );
    const quality = runEventQualityPipeline({
      candidatesDiscovered: candidates.length,
      events: normalized.flatMap(({ event }) => (event ? [event] : [])),
      now: now(),
      policy: getEventQualityPolicy(),
      previousSuccessfulEventCount: previousSnapshot?.events.length,
      validCityIds: [context.city.id],
    });
    logEventRefreshObservability({
      candidates,
      fetchedCount: candidates.length,
      normalized,
      parsedCount: candidates.length,
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
      parserWarnings: candidates.flatMap((candidate) => candidate.parserWarnings ?? []),
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
