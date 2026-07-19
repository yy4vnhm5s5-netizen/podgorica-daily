import { getEventQualityPolicy } from "../../../config/event-quality.ts";
import { normalizeEventCandidate } from "../domain/event-normalization.ts";
import { runEventQualityPipeline, type EventQualityDiagnostics } from "../domain/event-quality.ts";
import { CnpFetchError, type CnpHttpClient } from "./cnp-http-client.ts";
import {
  logEventRefreshObservability,
  logEventRefreshParsedSample,
} from "./event-refresh-observability.ts";
import { writeEventCache, type EventCacheSnapshot } from "./events-cache.ts";
import {
  cnpRepertoireUrl,
  discoverCnpEventUrls,
  parseCnpEventArticle,
  parseCnpRepertoire,
} from "./cnp-event-parser.ts";
import type { CityContext } from "@/shared/types/city";

type CnpRefreshErrorCode = CnpFetchError["code"] | "cnp-cache-write-failed";
type CnpRefreshClassification = "fresh" | "retained" | "failed";

interface CnpRefreshResult {
  cachePath: string;
  classification: CnpRefreshClassification;
  detailPagesRequested: number;
  diagnostics?: EventQualityDiagnostics;
  errorCode?: CnpRefreshErrorCode;
  lastRefreshError?: string;
  refreshedAt: string;
  retainedPreviousSnapshot: boolean;
  snapshot: EventCacheSnapshot | null;
  success: boolean;
  zeroResultProtectionTriggered: boolean;
}

async function refreshCnpEvents({
  cachePath,
  context,
  httpClient,
  now = () => new Date(),
  previousSnapshot,
  writeCache = writeEventCache,
}: {
  cachePath: string;
  context: CityContext;
  httpClient: CnpHttpClient;
  now?: () => Date;
  previousSnapshot?: EventCacheSnapshot | null;
  writeCache?: (snapshot: EventCacheSnapshot, cachePath: string) => Promise<void>;
}): Promise<CnpRefreshResult> {
  const refreshedAt = now().toISOString();
  let detailPagesRequested = 0;

  try {
    const repertoireHtml = await httpClient.get(cnpRepertoireUrl);
    const repertoireCandidates = parseCnpRepertoire(repertoireHtml);
    const urls = repertoireCandidates.length
      ? []
      : discoverCnpEventUrls(repertoireHtml).slice(0, 20);
    detailPagesRequested = urls.length;
    const parsed = repertoireCandidates.length
      ? repertoireCandidates.map((candidate) => ({ candidate, venue: undefined }))
      : await Promise.all(
          urls.map(async (url) => parseCnpEventArticle(await httpClient.get(url), url)),
        );
    const candidates = parsed.map(({ candidate }) => candidate);
    logEventRefreshParsedSample({ candidates, provider: "cnp" });
    const normalized = parsed.map(({ candidate }) =>
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
      fetchedCount: urls.length,
      normalized,
      parsedCount: parsed.length,
      provider: "cnp",
      quality,
    });

    if (quality.diagnostics.finalEventCount === 0 && previousSnapshot?.events.length) {
      return retainedResult({
        cachePath,
        detailPagesRequested,
        diagnostics: quality.diagnostics,
        previousSnapshot,
        refreshedAt,
        zeroResultProtectionTriggered: true,
      });
    }

    const snapshot: EventCacheSnapshot = {
      events: quality.finalEvents,
      fetchedAt: refreshedAt,
      freshnessStatus: "fresh",
      lastSuccessfulRefreshAt: refreshedAt,
      parserWarnings: [
        ...parsed.flatMap(({ candidate }) => candidate.parserWarnings),
        ...normalized.flatMap(({ parserWarnings }) => parserWarnings),
      ],
      provider: {
        displayName: "Crnogorsko narodno pozorište events",
        id: "cnp",
        sourceUrl: cnpRepertoireUrl,
      },
      qualityDiagnostics: quality.diagnostics,
      rejectedEventIds: quality.rejected.flatMap(({ eventId }) => (eventId ? [eventId] : [])),
      schemaVersion: 2,
      venues: parsed.flatMap(({ venue }) => (venue ? [venue] : [])),
    };
    await writeCache(snapshot, cachePath);
    return {
      cachePath,
      classification: "fresh",
      detailPagesRequested,
      diagnostics: quality.diagnostics,
      refreshedAt,
      retainedPreviousSnapshot: false,
      snapshot,
      success: true,
      zeroResultProtectionTriggered: false,
    };
  } catch (error) {
    return failureResult({
      cachePath,
      detailPagesRequested,
      error,
      previousSnapshot,
      refreshedAt,
    });
  }
}

function retainedResult({
  cachePath,
  detailPagesRequested,
  diagnostics,
  previousSnapshot,
  refreshedAt,
  zeroResultProtectionTriggered,
}: {
  cachePath: string;
  detailPagesRequested: number;
  diagnostics: EventQualityDiagnostics;
  previousSnapshot: EventCacheSnapshot;
  refreshedAt: string;
  zeroResultProtectionTriggered: boolean;
}): CnpRefreshResult {
  return {
    cachePath,
    classification: "retained",
    detailPagesRequested,
    diagnostics,
    lastRefreshError: "No valid CNP events were collected.",
    refreshedAt,
    retainedPreviousSnapshot: true,
    snapshot: previousSnapshot,
    success: false,
    zeroResultProtectionTriggered,
  };
}

function failureResult({
  cachePath,
  detailPagesRequested,
  error,
  previousSnapshot,
  refreshedAt,
}: {
  cachePath: string;
  detailPagesRequested: number;
  error: unknown;
  previousSnapshot: EventCacheSnapshot | null | undefined;
  refreshedAt: string;
}): CnpRefreshResult {
  const errorCode: CnpRefreshErrorCode =
    error instanceof CnpFetchError ? error.code : "cnp-cache-write-failed";
  const lastRefreshError =
    error instanceof CnpFetchError ? error.message : "CNP cache could not be updated.";
  if (previousSnapshot) {
    return {
      cachePath,
      classification: "retained",
      detailPagesRequested,
      errorCode,
      lastRefreshError,
      refreshedAt,
      retainedPreviousSnapshot: true,
      snapshot: previousSnapshot,
      success: false,
      zeroResultProtectionTriggered: false,
    };
  }
  return {
    cachePath,
    classification: "failed",
    detailPagesRequested,
    errorCode,
    lastRefreshError,
    refreshedAt,
    retainedPreviousSnapshot: false,
    snapshot: null,
    success: false,
    zeroResultProtectionTriggered: false,
  };
}

export {
  refreshCnpEvents,
  type CnpRefreshClassification,
  type CnpRefreshErrorCode,
  type CnpRefreshResult,
};
