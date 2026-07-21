import type { CityAlert } from "../domain/city-alert.ts";
import {
  calculateFreshness,
  isSafeCedisCacheAlert,
  type CedisCacheSnapshot,
} from "./cedis-cache.ts";
import type { CedisHttpClient, CedisHttpDocument } from "./cedis-http-client.ts";
import {
  cedisOrigin,
  discoverCedisArticles,
  parseCedisArticleResult,
} from "./cedis-planned-outages.ts";

type RefreshClassification =
  "failed" | "structurally-suspicious" | "trustworthy-empty" | "trustworthy-non-empty";

interface RefreshInput {
  alerts: CityAlert[];
  inspectedArticles: number;
  listingConfidentlyEmpty?: boolean;
  parserWarnings: string[];
  sourceUrl: string;
}

interface RefreshCache {
  read(): Promise<CedisCacheSnapshot | null>;
  write(snapshot: CedisCacheSnapshot): Promise<void>;
}

interface CedisRefreshDependencies {
  cache: RefreshCache;
  diagnostic?: CedisDiagnosticEmitter;
  httpClient: CedisHttpClient;
  now?: () => Date;
}

type CedisDiagnosticEmitter = (payload: Record<string, unknown>) => void;

interface RefreshResult {
  classification: RefreshClassification;
  error?: string;
  errorCode?: string;
  freshAlertCount: number;
  retainedPreviousSnapshot: boolean;
  snapshot: CedisCacheSnapshot | null;
  success: boolean;
  warnings: string[];
}

function createRefreshResult(
  input: RefreshInput,
  previous: CedisCacheSnapshot | null,
  now = new Date(),
): RefreshResult {
  const malformedAlertCount = input.alerts.filter((alert) => !isSafeCedisCacheAlert(alert)).length;
  const alerts = deduplicateAlerts(input.alerts.filter(isSafeCedisCacheAlert));
  const parserWarnings = [
    ...input.parserWarnings,
    ...(malformedAlertCount > 0 ? ["embedded-code-artifact"] : []),
  ];
  const suspiciousEmpty =
    alerts.length === 0 &&
    ((input.inspectedArticles === 0 && !input.listingConfidentlyEmpty) ||
      parserWarnings.length > 0);

  if (suspiciousEmpty) {
    return retainPrevious(
      previous,
      "structurally-suspicious",
      "suspicious-empty-result",
      "CEDIS parser result is structurally suspicious.",
      parserWarnings,
    );
  }

  const timestamp = now.toISOString();
  const snapshot: CedisCacheSnapshot = {
    alerts,
    fetchedAt: timestamp,
    freshnessStatus: calculateFreshness(now, now),
    lastSuccessfulRefreshAt: timestamp,
    parserWarnings,
    schemaVersion: 1,
    source: "CEDIS",
    sourceUrl: input.sourceUrl,
  };
  return {
    classification: alerts.length === 0 ? "trustworthy-empty" : "trustworthy-non-empty",
    freshAlertCount: alerts.length,
    retainedPreviousSnapshot: false,
    snapshot,
    success: true,
    warnings: parserWarnings,
  };
}

async function refreshCedis({
  cache,
  diagnostic = emitCedisDiagnostic,
  httpClient,
  now = () => new Date(),
}: CedisRefreshDependencies) {
  let phase = "cache-read";
  let previous: CedisCacheSnapshot | null;
  try {
    previous = await cache.read();
  } catch {
    diagnostic({
      event: "cedis-refresh-failed",
      phase,
      reason: "cache-read-failed",
    });
    return retainPrevious(
      null,
      "failed",
      "cache-read-failed",
      "CEDIS cache could not be read.",
      [],
    );
  }
  const sourceUrl = `${cedisOrigin}/servisne-informacije/`;
  try {
    phase = "listing-fetch";
    const listing = await getCedisDocument(httpClient, sourceUrl);
    diagnostic({
      contentType: listing.contentType ?? "",
      event: "cedis-refresh-listing-fetched",
      finalUrl: listing.finalUrl,
      htmlLength: listing.html.length,
      httpStatus: listing.status,
      requestedUrl: sourceUrl,
    });

    phase = "listing-discovery";
    const articles = discoverCedisArticles(listing.html, now()).slice(0, 7);
    diagnostic({
      event: "cedis-refresh-article-discovery",
      plannedWorkArticleCount: articles.length,
    });
    if (articles.length === 0 && containsPlannedWorkReference(listing.html)) {
      diagnostic({
        event: "cedis-refresh-listing-rejected",
        reason: "listing-links-unrecognized",
      });
      return retainPrevious(
        previous,
        "structurally-suspicious",
        "listing-links-unrecognized",
        "CEDIS listing contains planned-work references but no usable article links.",
        ["listing-links-unrecognized"],
      );
    }

    phase = "article-processing";
    const parsedArticles = await Promise.all(
      articles.map(async (article) => {
        let articleDocument: CedisHttpDocument;
        try {
          articleDocument = await getCedisDocument(httpClient, article.url);
          diagnostic({
            articleUrl: article.url,
            contentType: articleDocument.contentType ?? "",
            event: "cedis-refresh-article-fetched",
            finalUrl: articleDocument.finalUrl,
            htmlLength: articleDocument.html.length,
            httpStatus: articleDocument.status,
            requestedUrl: article.url,
          });
        } catch (error) {
          diagnostic({
            articleUrl: article.url,
            errorCode: getErrorCode(error),
            errorMessage: getErrorMessage(error),
            event: "cedis-refresh-article-failed",
            phase: "article-fetch",
          });
          throw error;
        }

        let parsed: ReturnType<typeof parseCedisArticleResult>;
        try {
          parsed = parseCedisArticleResult(article, articleDocument.html, now());
        } catch (error) {
          diagnostic({
            articleUrl: article.url,
            errorCode: getErrorCode(error),
            errorMessage: getErrorMessage(error),
            event: "cedis-refresh-article-failed",
            phase: "article-parser",
          });
          throw error;
        }
        diagnostic({
          articleUrl: article.url,
          contentSelector: parsed.contentSelector ?? "",
          event: "cedis-refresh-article-parsed",
          parsedRecordCount: parsed.alerts.length,
          podgoricaHeadingFound: parsed.podgoricaHeadingFound,
          ...(parsed.zeroRecordsReason ? { zeroRecordsReason: parsed.zeroRecordsReason } : {}),
        });
        return parsed;
      }),
    );
    const parserWarnings = parsedArticles.flatMap((result) => result.warnings);
    if (parsedArticles.some((result) => !result.contentRecognized)) {
      parserWarnings.push("article-content-unrecognized");
    }
    const result = createRefreshResult(
      {
        alerts: parsedArticles.flatMap((parsed) => parsed.alerts),
        inspectedArticles: articles.length,
        listingConfidentlyEmpty: articles.length === 0,
        parserWarnings,
        sourceUrl,
      },
      previous,
      now(),
    );
    diagnostic({
      classification: result.classification,
      event: "cedis-refresh-result",
      freshAlertCount: result.freshAlertCount,
      retainedPreviousSnapshot: result.retainedPreviousSnapshot,
      ...(result.errorCode ? { errorCode: result.errorCode } : {}),
      warnings: result.warnings,
    });
    if (!result.success || !result.snapshot) return result;

    try {
      phase = "cache-write";
      await cache.write(result.snapshot);
      diagnostic({
        cacheWriteResult: "written",
        event: "cedis-refresh-cache-write",
        freshAlertCount: result.freshAlertCount,
        retainedPreviousSnapshot: false,
      });
      return result;
    } catch (error) {
      diagnostic({
        errorCode: getErrorCode(error),
        errorMessage: getErrorMessage(error),
        event: "cedis-refresh-cache-write",
        phase,
        result: "failed",
      });
      return retainPrevious(
        previous,
        "failed",
        "cache-write-failed",
        "CEDIS cache could not be updated.",
        result.warnings,
      );
    }
  } catch (error) {
    diagnostic({
      errorCode: getErrorCode(error),
      errorMessage: getErrorMessage(error),
      event: "cedis-refresh-failed",
      phase,
    });
    return retainPrevious(
      previous,
      "failed",
      getErrorCode(error),
      "CEDIS refresh could not be completed.",
      [],
    );
  }
}

async function getCedisDocument(
  httpClient: CedisHttpClient,
  url: string,
): Promise<CedisHttpDocument> {
  if (httpClient.getDocument) return httpClient.getDocument(url);

  return {
    finalUrl: url,
    html: await httpClient.get(url),
    status: 200,
  };
}

function emitCedisDiagnostic(payload: Record<string, unknown>) {
  console.info(JSON.stringify(payload));
}

function retainPrevious(
  previous: CedisCacheSnapshot | null,
  classification: "failed" | "structurally-suspicious",
  errorCode: string,
  error: string,
  warnings: string[],
): RefreshResult {
  const snapshot = previous
    ? { ...previous, freshnessStatus: "stale" as const, lastRefreshError: error }
    : null;
  return {
    classification,
    error,
    errorCode,
    freshAlertCount: previous?.alerts.length ?? 0,
    retainedPreviousSnapshot: Boolean(previous),
    snapshot,
    success: false,
    warnings,
  };
}

function containsPlannedWorkReference(html: string) {
  return /planiran[ai]\s+radov/i.test(html);
}

function deduplicateAlerts(alerts: CityAlert[]) {
  return [...new Map(alerts.map((alert) => [alert.id, alert])).values()];
}

function getErrorCode(error: unknown) {
  return typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
    ? error.code
    : "cedis-refresh-failed";
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown CEDIS refresh error.";
}

export {
  createRefreshResult,
  refreshCedis,
  type CedisRefreshDependencies,
  type CedisDiagnosticEmitter,
  type RefreshCache,
  type RefreshClassification,
  type RefreshInput,
  type RefreshResult,
};
