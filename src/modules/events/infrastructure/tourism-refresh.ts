import { getEventQualityPolicy } from "../../../config/event-quality.ts";
import { normalizeEventCandidate } from "../domain/event-normalization.ts";
import { runEventQualityPipeline } from "../domain/event-quality.ts";
import { writeEventCache, type EventCacheSnapshot } from "./events-cache.ts";
import { emitInfo } from "./event-refresh-logger.ts";
import {
  logEventRefreshObservability,
  logEventRefreshParsedSample,
} from "./event-refresh-observability.ts";
import type { TourismHttpClient } from "./tourism-http-client.ts";
import {
  discoverTourismEventUrls,
  parseTourismEventArticle,
  tourismCalendarUrl,
} from "./tourism-event-parser.ts";
import type { CityContext } from "@/shared/types/city";

interface TourismRefreshResult {
  detailFetchCount: number;
  lastRefreshError?: string;
  retainedPreviousSnapshot: boolean;
  snapshot: EventCacheSnapshot | null;
  success: boolean;
}
async function refreshTourismEvents({
  cachePath,
  context,
  httpClient,
  now = () => new Date(),
  previousSnapshot,
  writeCache = writeEventCache,
}: {
  cachePath: string;
  context: CityContext;
  httpClient: TourismHttpClient;
  now?: () => Date;
  previousSnapshot?: EventCacheSnapshot | null;
  writeCache?: (snapshot: EventCacheSnapshot, path: string) => Promise<void>;
}): Promise<TourismRefreshResult> {
  let detailFetchCount = 0;
  try {
    const urls = discoverTourismEventUrls(await httpClient.get(tourismCalendarUrl)).slice(0, 20);
    const parsed = await Promise.all(
      urls.map(async (url) => {
        try {
          detailFetchCount++;
          return parseTourismEventArticle(await httpClient.get(url), url);
        } catch {
          emitInfo({
            event: "events-refresh-rejected-event",
            provider: "tourism-podgorica",
            reasons: ["other"],
            sourceUrl: url,
          });
          return null;
        }
      }),
    );
    const candidates = parsed.flatMap((item) => (item ? [item.candidate] : []));
    logEventRefreshParsedSample({ candidates, provider: "tourism-podgorica" });
    const normalized = parsed.flatMap((item) =>
      item ? [normalizeEventCandidate(item.candidate, context, now())] : [],
    );
    const quality = runEventQualityPipeline({
      candidatesDiscovered: urls.length,
      events: normalized.flatMap(({ event }) => (event ? [event] : [])),
      now: now(),
      policy: getEventQualityPolicy(),
      previousSuccessfulEventCount: previousSnapshot?.events.length,
      validCityIds: [context.city.id],
    });
    logEventRefreshObservability({
      candidates,
      fetchedCount: urls.length,
      normalized,
      parsedCount: parsed.filter(Boolean).length,
      provider: "tourism-podgorica",
      quality,
    });
    if (!quality.finalEvents.length && previousSnapshot?.events.length)
      return {
        detailFetchCount,
        lastRefreshError: "No valid Tourism events were collected.",
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
      parserWarnings: parsed.flatMap((item) => item?.candidate.parserWarnings ?? []),
      provider: {
        displayName: "Turistička organizacija Podgorice events",
        id: "tourism-podgorica",
        sourceUrl: tourismCalendarUrl,
      },
      qualityDiagnostics: quality.diagnostics,
      rejectedEventIds: quality.rejected.flatMap(({ eventId }) => (eventId ? [eventId] : [])),
      schemaVersion: 2,
      venues: [],
    };
    await writeCache(snapshot, cachePath);
    return { detailFetchCount, retainedPreviousSnapshot: false, snapshot, success: true };
  } catch {
    return {
      detailFetchCount,
      lastRefreshError: "Tourism refresh failed.",
      retainedPreviousSnapshot: Boolean(previousSnapshot),
      snapshot: previousSnapshot ?? null,
      success: false,
    };
  }
}
export { refreshTourismEvents, type TourismRefreshResult };
