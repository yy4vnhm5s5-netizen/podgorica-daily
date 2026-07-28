import {
  buildCalendarDataRequestBody,
  buildMapDataRequestBody,
  morskodobroCalendarDataUrl,
  morskodobroMapDataUrl,
  parseBudvaSeaWaterQualitySummary,
  parseCurrentRoundId,
} from "./budva-sea-water-quality.ts";
import {
  defaultBudvaSeaWaterQualityCachePath,
  readBudvaSeaWaterQualityCache,
  writeBudvaSeaWaterQualityCache,
  type BudvaSeaWaterQualityCacheSnapshot,
} from "./budva-sea-water-quality-cache.ts";
import type { MorskodobroHttpClient } from "./morskodobro-http-client.ts";

const seaWaterQualitySourceUrl = "https://monitoring.morskodobro.me";

type BudvaSeaWaterQualityDiagnosticEmitter = (payload: Record<string, unknown>) => void;

interface BudvaSeaWaterQualityRefreshResult {
  errorCode?: string;
  retainedPreviousSnapshot: boolean;
  snapshot: BudvaSeaWaterQualityCacheSnapshot | null;
  success: boolean;
  totalLocations: number;
  warnings: string[];
}

async function refreshBudvaSeaWaterQuality({
  cachePath = defaultBudvaSeaWaterQualityCachePath,
  diagnostic = emitBudvaSeaWaterQualityDiagnostic,
  httpClient,
  now = () => new Date(),
}: {
  cachePath?: string;
  diagnostic?: BudvaSeaWaterQualityDiagnosticEmitter;
  httpClient: MorskodobroHttpClient;
  now?: () => Date;
}): Promise<BudvaSeaWaterQualityRefreshResult> {
  const previous = await readBudvaSeaWaterQualityCache(cachePath);

  try {
    const calendarBody = await httpClient.post(
      morskodobroCalendarDataUrl,
      buildCalendarDataRequestBody(),
    );
    const round = parseCurrentRoundId(calendarBody);
    if (round === undefined) {
      return retainPrevious(previous, "sea-water-quality-calendar-unrecognized");
    }

    const mapBody = await httpClient.post(
      morskodobroMapDataUrl,
      buildMapDataRequestBody({ round, year: now().getFullYear() }),
    );
    const parsed = parseBudvaSeaWaterQualitySummary(mapBody);
    if (!parsed) {
      return retainPrevious(previous, "sea-water-quality-response-unrecognized");
    }
    const { summary, warnings } = parsed;
    if (warnings.length > 0) {
      diagnostic({
        event: "sea-water-quality-parser-warning",
        provider: "budva-sea-water-quality",
        totalLocations: summary.totalLocations,
        warnings,
      });
    }

    const timestamp = now().toISOString();
    const snapshot: BudvaSeaWaterQualityCacheSnapshot = {
      fetchedAt: timestamp,
      lastSuccessfulRefreshAt: timestamp,
      parserWarnings: warnings,
      schemaVersion: 1,
      source: "Javno preduzeće za upravljanje morskim dobrom Crne Gore",
      sourceUrl: seaWaterQualitySourceUrl,
      summary,
    };

    try {
      await writeBudvaSeaWaterQualityCache(snapshot, cachePath);
    } catch {
      return retainPrevious(previous, "sea-water-quality-cache-write-failed");
    }

    return {
      retainedPreviousSnapshot: false,
      snapshot,
      success: true,
      totalLocations: summary.totalLocations,
      warnings,
    };
  } catch (error) {
    return retainPrevious(previous, getErrorCode(error));
  }
}

function emitBudvaSeaWaterQualityDiagnostic(payload: Record<string, unknown>) {
  console.warn(JSON.stringify(payload));
}

function retainPrevious(
  previous: BudvaSeaWaterQualityCacheSnapshot | null,
  errorCode: string,
): BudvaSeaWaterQualityRefreshResult {
  return {
    errorCode,
    retainedPreviousSnapshot: Boolean(previous),
    snapshot: previous ? { ...previous, lastRefreshError: errorCode } : null,
    success: false,
    totalLocations: previous?.summary.totalLocations ?? 0,
    warnings: [],
  };
}

function getErrorCode(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
    ? error.code
    : "sea-water-quality-refresh-failed";
}

export {
  emitBudvaSeaWaterQualityDiagnostic,
  refreshBudvaSeaWaterQuality,
  seaWaterQualitySourceUrl,
  type BudvaSeaWaterQualityDiagnosticEmitter,
  type BudvaSeaWaterQualityRefreshResult,
};
