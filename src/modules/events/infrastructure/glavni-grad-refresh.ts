import { getEventQualityPolicy } from "../../../config/event-quality.ts";
import { normalizeEventCandidate } from "../domain/event-normalization.ts";
import { runEventQualityPipeline } from "../domain/event-quality.ts";
import { writeEventCache, type EventCacheSnapshot } from "./events-cache.ts";
import { logEventRefreshObservability } from "./event-refresh-observability.ts";
import type { GlavniGradHttpClient } from "./glavni-grad-http-client.ts";
import {
  discoverGlavniGradEventUrls,
  glavniGradEventsUrl,
  parseGlavniGradEventArticle,
} from "./glavni-grad-event-parser.ts";
import type { CityContext } from "@/shared/types/city";

async function refreshGlavniGradEvents({
  cachePath,
  context,
  httpClient,
  now = () => new Date(),
  writeCache = writeEventCache,
}: {
  cachePath: string;
  context: CityContext;
  httpClient: GlavniGradHttpClient;
  now?: () => Date;
  writeCache?: (snapshot: EventCacheSnapshot, cachePath: string) => Promise<void>;
}) {
  const urls = discoverGlavniGradEventUrls(await httpClient.get(glavniGradEventsUrl)).slice(0, 20);
  const parsed = await Promise.all(
    urls.map(async (url) => parseGlavniGradEventArticle(await httpClient.get(url), url)),
  );
  const candidates = parsed.map(({ candidate }) => candidate);
  const normalized = parsed.map(({ candidate }) =>
    normalizeEventCandidate(candidate, context, now()),
  );
  const quality = runEventQualityPipeline({
    candidatesDiscovered: urls.length,
    events: normalized.flatMap(({ event }) => (event ? [event] : [])),
    now: now(),
    policy: getEventQualityPolicy(),
    validCityIds: [context.city.id],
  });
  logEventRefreshObservability({
    candidates,
    fetchedCount: urls.length,
    normalized,
    parsedCount: parsed.length,
    provider: "glavni-grad-podgorica",
    quality,
  });
  const timestamp = now().toISOString();
  const snapshot: EventCacheSnapshot = {
    events: quality.finalEvents,
    fetchedAt: timestamp,
    freshnessStatus: "fresh",
    lastSuccessfulRefreshAt: timestamp,
    parserWarnings: parsed.flatMap(({ candidate }) => candidate.parserWarnings),
    provider: {
      displayName: "Glavni grad Podgorica events",
      id: "glavni-grad-podgorica",
      sourceUrl: glavniGradEventsUrl,
    },
    qualityDiagnostics: quality.diagnostics,
    rejectedEventIds: quality.rejected.flatMap(({ eventId }) => (eventId ? [eventId] : [])),
    schemaVersion: 2,
    venues: parsed.flatMap(({ venue }) => (venue ? [venue] : [])),
  };
  await writeCache(snapshot, cachePath);
  return snapshot;
}

export { refreshGlavniGradEvents };
