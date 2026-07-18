import type { CityAlert } from "../domain/city-alert.ts";
import { calculateVikpgFreshness, type VikpgCacheSnapshot } from "./vikpg-cache.ts";
import type { VikpgHttpClient } from "./vikpg-http-client.ts";
import {
  discoverVikpgNotices,
  parseVikpgNotice,
  vikpgWaterNoticesUrl,
} from "./vikpg-water-notices.ts";

type VikpgRefreshClassification =
  | "failed"
  | "structurally-suspicious"
  | "trustworthy-empty"
  | "trustworthy-non-empty";

interface VikpgRefreshCache {
  read(): Promise<VikpgCacheSnapshot | null>;
  write(snapshot: VikpgCacheSnapshot): Promise<void>;
}

interface VikpgRefreshResult {
  classification: VikpgRefreshClassification;
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

    const parsed = await Promise.all(
      notices.map(async (notice) => parseVikpgNotice(notice, await httpClient.get(notice.url), now())),
    );
    const warnings = parsed.flatMap((notice) => notice.warnings);
    if (parsed.some((notice) => !notice.contentRecognized)) warnings.push("article-content-unrecognized");
    const alerts = deduplicateAlerts(
      parsed
        .flatMap(({ alert }) => (alert ? [alert] : []))
        .filter(({ status }) => status === "active" || status === "scheduled"),
    );
    const suspiciousEmpty =
      alerts.length === 0 &&
      ((notices.length > 0 && warnings.length > 0) || (notices.length === 0 && !hasServiceInformationSection(listing)));
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
): VikpgRefreshResult {
  return {
    classification,
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
  return typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
    ? error.code
    : "vikpg-refresh-failed";
}

export { refreshVikpg, type VikpgRefreshCache, type VikpgRefreshClassification, type VikpgRefreshResult };
