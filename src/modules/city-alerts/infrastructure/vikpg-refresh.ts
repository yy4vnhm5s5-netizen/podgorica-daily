import type { CityAlert } from "../domain/city-alert.ts";
import { calculateVikpgFreshness, type VikpgCacheSnapshot } from "./vikpg-cache.ts";
import {
  VikpgFetchError,
  type VikpgHttpClient,
  type VikpgNetworkErrorType,
} from "./vikpg-http-client.ts";
import {
  canonicalizeVikpgSourceUrl,
  discoverVikpgNotices,
  parseVikpgNotice,
  vikpgWaterNoticesUrl,
  type VikpgNoticeLink,
  type VikpgParseResult,
} from "./vikpg-water-notices.ts";

type VikpgRefreshClassification =
  "failed" | "structurally-suspicious" | "trustworthy-empty" | "trustworthy-non-empty";

interface VikpgRefreshCache {
  read(): Promise<VikpgCacheSnapshot | null>;
  write(snapshot: VikpgCacheSnapshot): Promise<void>;
}

// Safe-to-log diagnostics carried from a failed VikpgFetchError into the refresh/collector
// summary: never the full HTML body, headers, cookies, query string, or a stack trace — only a
// bounded set of fields already sanitized by vikpg-http-client.ts.
interface VikpgFetchDiagnostics {
  emptyBody?: boolean;
  finalUrl?: string;
  httpStatus?: number;
  networkErrorType?: VikpgNetworkErrorType;
  redirected?: boolean;
  responseBodyPreview?: string;
}

interface VikpgRefreshResult {
  classification: VikpgRefreshClassification;
  diagnostics?: VikpgFetchDiagnostics;
  error?: string;
  errorCode?: string;
  retainedPreviousSnapshot: boolean;
  snapshot: VikpgCacheSnapshot | null;
  success: boolean;
  warnings: string[];
}

async function refreshVikpg({
  cache,
  httpClient,
  now = () => new Date(),
}: {
  cache: VikpgRefreshCache;
  httpClient: VikpgHttpClient;
  now?: () => Date;
}): Promise<VikpgRefreshResult> {
  let previous: VikpgCacheSnapshot | null;
  try {
    previous = await cache.read();
  } catch {
    return retainPrevious(null, "failed", "cache-read-failed", "VIK cache could not be read.", []);
  }

  try {
    const listing = await httpClient.get(vikpgWaterNoticesUrl);
    const notices = discoverVikpgNotices(listing, now()).slice(0, 12);
    if (notices.length === 0 && !hasServiceInformationSection(listing)) {
      return retainPrevious(
        previous,
        "structurally-suspicious",
        "listing-content-unrecognized",
        "VIK listing content could not be recognized.",
        ["listing-content-unrecognized"],
      );
    }

    // Each notice is fetched and parsed independently: one bad detail page (for example a
    // discovery false-positive that still 404s) must not take down every other notice from the
    // same listing. Only when every single discovered notice fails do we re-throw — deliberately
    // re-entering the outer catch below, unchanged, so a fully failed refresh keeps exactly
    // today's retained-snapshot/errorCode/diagnostics behavior.
    const noticeOutcomes = await Promise.all(
      notices.map(async (notice) => {
        try {
          const detail = await httpClient.get(notice.url);
          return { notice, parsed: parseVikpgNotice(notice, detail, now()) };
        } catch (error) {
          return { error, notice };
        }
      }),
    );
    const failedOutcomes = noticeOutcomes.filter(
      (outcome): outcome is { error: unknown; notice: VikpgNoticeLink } => "error" in outcome,
    );
    if (notices.length > 0 && failedOutcomes.length === notices.length) {
      // .at(0) (rather than a `[0]!` non-null assertion) to safely pick one recorded error to
      // rethrow; this branch only runs when failedOutcomes is non-empty, but the type stays
      // honest either way.
      const firstFailure = failedOutcomes.at(0);
      if (firstFailure) throw firstFailure.error;
    }

    const successfulOutcomes = noticeOutcomes.filter(
      (outcome): outcome is { notice: VikpgNoticeLink; parsed: VikpgParseResult } =>
        "parsed" in outcome,
    );
    const parsed = successfulOutcomes.map(({ parsed: parseResult }) => parseResult);
    const warnings = parsed.flatMap((notice) => notice.warnings);
    // Count only, never the notice URL itself (which could carry a query string) — enough for
    // operational diagnostics without leaking anything into logs or the aggregate endpoint.
    if (failedOutcomes.length > 0) {
      warnings.push(`notice-fetch-failed:${failedOutcomes.length}`);
    }
    if (parsed.some((notice) => !notice.contentRecognized))
      warnings.push("article-content-unrecognized");
    const freshAlerts = deduplicateAlerts(
      parsed
        .flatMap(({ alert }) => (alert ? [alert] : []))
        .filter(({ status }) => status === "active" || status === "scheduled"),
    );
    // A partial failure must not silently shrink the cache: a failed detail fetch means this one
    // notice couldn't be reconfirmed, not that it has expired. Only the previously cached alert
    // for exactly that notice is carried forward — anything successfully refetched this run is
    // represented solely by its fresh result, so a notice whose content changed can never end up
    // duplicated under both its old and new content hash. Anything that has genuinely expired
    // since is still filtered out for readers at query time by getVikpgCityAlerts's own status
    // recomputation, independent of what stays in this cache file.
    //
    // Matching is done through canonicalizeVikpgSourceUrl on both sides, not raw string equality:
    // a previously cached sourceUrl and this run's notice.url can point at the very same VIK
    // resource while differing in a "www." prefix, a trailing slash, a fragment, or legacy
    // Joomla query-parameter order, and none of that should cause a false mismatch that silently
    // drops still-valid data. A sourceUrl that can't be canonicalized (malformed, or not a VIKPG
    // URL at all) is excluded from carry-forward rather than guessed at.
    const failedNoticeUrlKeys = new Set(
      failedOutcomes.flatMap(({ notice }) => {
        const key = canonicalizeVikpgSourceUrl(notice.url);
        return key ? [key] : [];
      }),
    );
    const alerts =
      failedNoticeUrlKeys.size === 0
        ? freshAlerts
        : deduplicateAlerts([
            ...(previous?.alerts ?? []).filter((alert) => {
              const key = alert.sourceUrl ? canonicalizeVikpgSourceUrl(alert.sourceUrl) : null;
              return key !== null && failedNoticeUrlKeys.has(key);
            }),
            ...freshAlerts,
          ]);
    const suspiciousEmpty =
      alerts.length === 0 &&
      ((notices.length > 0 && warnings.length > 0) ||
        (notices.length === 0 && !hasServiceInformationSection(listing)));
    if (suspiciousEmpty) {
      return retainPrevious(
        previous,
        "structurally-suspicious",
        "suspicious-empty-result",
        "VIK parser result is structurally suspicious.",
        warnings,
      );
    }

    const timestamp = now().toISOString();
    const snapshot: VikpgCacheSnapshot = {
      alerts,
      fetchedAt: timestamp,
      freshnessStatus: calculateVikpgFreshness(new Date(timestamp), new Date(timestamp)),
      lastSuccessfulRefreshAt: timestamp,
      parserWarnings: warnings,
      schemaVersion: 1,
      source: "Vodovod i kanalizacija Podgorica",
      sourceUrl: vikpgWaterNoticesUrl,
    };
    try {
      await cache.write(snapshot);
      return {
        classification: alerts.length === 0 ? "trustworthy-empty" : "trustworthy-non-empty",
        retainedPreviousSnapshot: false,
        snapshot,
        success: true,
        warnings,
      };
    } catch {
      return retainPrevious(
        previous,
        "failed",
        "cache-write-failed",
        "VIK cache could not be updated.",
        warnings,
      );
    }
  } catch (error) {
    return retainPrevious(
      previous,
      "failed",
      getErrorCode(error),
      "VIK refresh could not be completed.",
      [],
      getVikpgFetchDiagnostics(error),
    );
  }
}

function hasServiceInformationSection(html: string) {
  return /servisne\s+informacije/i.test(html);
}

function retainPrevious(
  previous: VikpgCacheSnapshot | null,
  classification: "failed" | "structurally-suspicious",
  errorCode: string,
  error: string,
  warnings: string[],
  diagnostics?: VikpgFetchDiagnostics,
): VikpgRefreshResult {
  return {
    classification,
    ...(diagnostics ? { diagnostics } : {}),
    error,
    errorCode,
    retainedPreviousSnapshot: Boolean(previous),
    snapshot: previous ? { ...previous, freshnessStatus: "stale", lastRefreshError: error } : null,
    success: false,
    warnings,
  };
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
    : "vikpg-refresh-failed";
}

// Only VikpgFetchError instances (thrown by the HTTP client) carry structured diagnostics; a
// cache-read/write failure or a classification decision elsewhere in this file has none to
// report, which is correct — those are not fetch-layer failures. A plain timeout has no extra
// fields either (see vikpg-http-client.ts), so this returns undefined rather than `{}` — the
// errorCode alone already says "timeout."
function getVikpgFetchDiagnostics(error: unknown): VikpgFetchDiagnostics | undefined {
  if (!(error instanceof VikpgFetchError)) return undefined;
  const { emptyBody, finalUrl, httpStatus, networkErrorType, redirected, responseBodyPreview } =
    error;
  const diagnostics: VikpgFetchDiagnostics = {
    ...(emptyBody !== undefined ? { emptyBody } : {}),
    ...(finalUrl !== undefined ? { finalUrl } : {}),
    ...(httpStatus !== undefined ? { httpStatus } : {}),
    ...(networkErrorType !== undefined ? { networkErrorType } : {}),
    ...(redirected !== undefined ? { redirected } : {}),
    ...(responseBodyPreview !== undefined ? { responseBodyPreview } : {}),
  };
  return Object.keys(diagnostics).length > 0 ? diagnostics : undefined;
}

export {
  refreshVikpg,
  type VikpgFetchDiagnostics,
  type VikpgRefreshCache,
  type VikpgRefreshClassification,
  type VikpgRefreshResult,
};
