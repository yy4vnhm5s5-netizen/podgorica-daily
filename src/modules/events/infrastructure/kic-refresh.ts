import { normalizeEventCandidate } from "../domain/event-normalization.ts";
import { runEventQualityPipeline } from "../domain/event-quality.ts";
import { getEventQualityPolicy } from "../../../config/event-quality.ts";
import {
  logEventRefreshObservability,
  logEventRefreshParsedSample,
} from "./event-refresh-observability.ts";
import type { EventCacheSnapshot } from "./events-cache.ts";
import { writeEventCache } from "./events-cache.ts";
import type { KicHttpClient } from "./kic-http-client.ts";
import { kicNewsUrl } from "./kic-http-client.ts";
import { discoverKicArticleUrls, parseKicEventArticle } from "./kic-event-parser.ts";
import type { CityContext } from "@/shared/types/city";

async function refreshKicEvents({
  cachePath,
  context,
  httpClient,
  now = () => new Date(),
  previousSnapshot,
  writeCache = writeEventCache,
}: {
  cachePath: string;
  context: CityContext;
  httpClient: KicHttpClient;
  now?: () => Date;
  previousSnapshot?: EventCacheSnapshot | null;
  writeCache?: (snapshot: EventCacheSnapshot, cachePath: string) => Promise<void>;
}) {
  const listing = await httpClient.get(kicNewsUrl);
  const urls = discoverKicArticleUrls(listing).slice(0, 20);
  const articles = await Promise.all(
    urls.map(async (url) => ({ url, html: await httpClient.get(url) })),
  );
  const parsed = articles.map(({ html, url }) => parseKicEventArticle(html, url));
  const candidates = parsed.map(({ candidate }) => candidate);
  logEventRefreshParsedSample({ candidates, provider: "kic" });
  const normalized = parsed.map(({ candidate }) =>
    normalizeEventCandidate(candidate, context, now()),
  );
  const timestamp = now().toISOString();
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
    parsedCount: parsed.length,
    provider: "kic",
    quality,
  });
  if (quality.diagnostics.finalEventCount === 0 && previousSnapshot?.events.length) {
    return {
      ...previousSnapshot,
      qualityDiagnostics: { ...quality.diagnostics, countDropWarning: true },
    };
  }
  const snapshot: EventCacheSnapshot = {
    events: quality.finalEvents,
    fetchedAt: timestamp,
    freshnessStatus: "fresh",
    lastSuccessfulRefreshAt: timestamp,
    parserWarnings: [
      ...parsed.flatMap(({ candidate }) => candidate.parserWarnings),
      ...normalized.flatMap(({ parserWarnings }) => parserWarnings),
    ],
    provider: {
      displayName: "KIC Budo Tomović events",
      id: "kic-budo-tomovic",
      sourceUrl: kicNewsUrl,
    },
    qualityDiagnostics: quality.diagnostics,
    schemaVersion: 2,
    venues: parsed.flatMap(({ venue }) => (venue ? [venue] : [])),
  };
  await writeCache(snapshot, cachePath);
  return snapshot;
}

export { refreshKicEvents };
