import type { AmscgCacheSnapshot } from "./amscg-cache.ts";
import { calculateAmscgFreshness } from "./amscg-cache.ts";
import type { AmscgHttpClient } from "./amscg-http-client.ts";
import { amscgRoadConditionsUrl } from "./amscg-http-client.ts";
import { parseAmscgRoadConditions } from "./amscg-road-conditions.ts";

interface AmscgRefreshCache {
  read(): Promise<AmscgCacheSnapshot | null>;
  write(snapshot: AmscgCacheSnapshot): Promise<void>;
}

interface AmscgRefreshResult {
  errorCode?: string;
  retainedPreviousSnapshot: boolean;
  snapshot: AmscgCacheSnapshot | null;
  success: boolean;
  warnings: string[];
}

async function refreshAmscg({
  cache,
  httpClient,
  now = () => new Date(),
}: {
  cache: AmscgRefreshCache;
  httpClient: AmscgHttpClient;
  now?: () => Date;
}): Promise<AmscgRefreshResult> {
  const previous = await cache.read().catch(() => null);
  try {
    const parsed = parseAmscgRoadConditions(await httpClient.get(amscgRoadConditionsUrl));
    if (!parsed.contentRecognized)
      return retainPrevious(previous, "amscg-content-unrecognized", parsed.warnings);

    const timestamp = now().toISOString();
    const snapshot: AmscgCacheSnapshot = {
      alerts: parsed.alerts,
      fetchedAt: timestamp,
      freshnessStatus: calculateAmscgFreshness(new Date(timestamp), new Date(timestamp)),
      lastSuccessfulRefreshAt: timestamp,
      parserWarnings: parsed.warnings,
      schemaVersion: 1,
      source: "AMSCG",
      sourceUrl: amscgRoadConditionsUrl,
    };
    await cache.write(snapshot);
    return { retainedPreviousSnapshot: false, snapshot, success: true, warnings: parsed.warnings };
  } catch (error) {
    return retainPrevious(previous, getErrorCode(error), []);
  }
}

function retainPrevious(
  previous: AmscgCacheSnapshot | null,
  errorCode: string,
  warnings: string[],
): AmscgRefreshResult {
  return {
    errorCode,
    retainedPreviousSnapshot: Boolean(previous),
    snapshot: previous ? { ...previous, freshnessStatus: "stale" } : null,
    success: false,
    warnings,
  };
}

function getErrorCode(error: unknown) {
  return typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
    ? error.code
    : "amscg-refresh-failed";
}

export { refreshAmscg, type AmscgRefreshCache, type AmscgRefreshResult };
