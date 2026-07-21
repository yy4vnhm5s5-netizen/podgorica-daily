import type { CityAlert } from "../domain/city-alert.ts";
import {
  calculateFreshness,
  isSafeCedisCacheAlert,
  type CedisCacheSnapshot,
} from "./cedis-cache.ts";
import type { CedisHttpClient } from "./cedis-http-client.ts";
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
  httpClient: CedisHttpClient;
  now?: () => Date;
}

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
  httpClient,
  now = () => new Date(),
}: CedisRefreshDependencies) {
  let previous: CedisCacheSnapshot | null;
  try {
    previous = await cache.read();
  } catch {
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
    const listing = await httpClient.get(sourceUrl);
    const articles = discoverCedisArticles(listing, now()).slice(0, 7);
    if (articles.length === 0 && containsPlannedWorkReference(listing)) {
      return retainPrevious(
        previous,
        "structurally-suspicious",
        "listing-links-unrecognized",
        "CEDIS listing contains planned-work references but no usable article links.",
        ["listing-links-unrecognized"],
      );
    }

    const parsedArticles = await Promise.all(
      articles.map(async (article) =>
        parseCedisArticleResult(article, await httpClient.get(article.url), now()),
      ),
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
    if (!result.success || !result.snapshot) return result;

    try {
      await cache.write(result.snapshot);
      return result;
    } catch {
      return retainPrevious(
        previous,
        "failed",
        "cache-write-failed",
        "CEDIS cache could not be updated.",
        result.warnings,
      );
    }
  } catch (error) {
    return retainPrevious(
      previous,
      "failed",
      getErrorCode(error),
      "CEDIS refresh could not be completed.",
      [],
    );
  }
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

export {
  createRefreshResult,
  refreshCedis,
  type CedisRefreshDependencies,
  type RefreshCache,
  type RefreshClassification,
  type RefreshInput,
  type RefreshResult,
};
