import { dirname, join } from "node:path";

import {
  buildCalendarDataRequestBody,
  buildMapDataRequestBody,
  morskodobroCalendarDataUrl,
  morskodobroMapDataUrl,
  parseBudvaSeaWaterQualitySummary,
  parseCurrentRoundId,
} from "./budva-sea-water-quality.ts";
import {
  getSeaWaterQualityCachePath,
  readBudvaSeaWaterQualityCache,
  writeBudvaSeaWaterQualityCache,
  type BudvaSeaWaterQualityCacheSnapshot,
} from "./budva-sea-water-quality-cache.ts";
import {
  mergeSeaWaterQualityHistory,
  readSeaWaterQualityHistoryCache,
  writeSeaWaterQualityHistoryCache,
  type SeaWaterQualityHistoryCacheSnapshot,
} from "./sea-water-quality-history-cache.ts";
import type { MorskodobroHttpClient } from "./morskodobro-http-client.ts";
import {
  getSeaWaterQualityMunicipality,
  type SeaWaterQualitySupportedCityId,
} from "./sea-water-quality-cities.ts";

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
  cityId = "budva",
  cachePath = getSeaWaterQualityCachePath(cityId),
  historyCachePath,
  diagnostic = emitBudvaSeaWaterQualityDiagnostic,
  httpClient,
  now = () => new Date(),
}: {
  cachePath?: string;
  cityId?: SeaWaterQualitySupportedCityId;
  diagnostic?: BudvaSeaWaterQualityDiagnosticEmitter;
  historyCachePath?: string;
  httpClient: MorskodobroHttpClient;
  now?: () => Date;
}): Promise<BudvaSeaWaterQualityRefreshResult> {
  const resolvedHistoryCachePath =
    historyCachePath ?? join(dirname(cachePath), `${cityId}-sea-water-quality-history.json`);
  const previous = await readBudvaSeaWaterQualityCache(cachePath);
  const previousHistory = await readSeaWaterQualityHistoryCache(resolvedHistoryCachePath);
  // Type-safe by construction: every SeaWaterQualitySupportedCityId has a matching config entry.
  const municipalityId = getSeaWaterQualityMunicipality(cityId)!.municipalityId;

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
      buildMapDataRequestBody({ municipalityId, round, year: now().getFullYear() }),
    );
    const parsed = parseBudvaSeaWaterQualitySummary(mapBody, cityId);
    if (!parsed) {
      return retainPrevious(previous, "sea-water-quality-response-unrecognized");
    }
    const { summary, warnings } = parsed;
    // A structurally valid response reporting zero locations is treated the same as an
    // unrecognized one when there's a non-empty previous snapshot to protect — otherwise a
    // transient upstream blip (e.g. an off-season or momentarily empty crtajMapu response) would
    // silently wipe out a city's real beach list. No hardcoded minimum: exactly zero is the
    // trigger. When there is no previous snapshot, or the previous one was itself empty, this
    // still writes normally — first-ever collection and genuinely empty sources both proceed.
    if (summary.totalLocations === 0 && previous?.summary.totalLocations) {
      return retainPrevious(previous, "sea-water-quality-empty-response");
    }
    if (warnings.length > 0) {
      diagnostic({
        event: "sea-water-quality-parser-warning",
        provider: `${cityId}-sea-water-quality`,
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
    const historySnapshot: SeaWaterQualityHistoryCacheSnapshot = {
      fetchedAt: timestamp,
      history: mergeSeaWaterQualityHistory({
        cityId,
        previous: previousHistory?.history,
        round: parsed.sourceRound ?? round,
        summaryLocations: summary.locations,
        year: now().getFullYear(),
      }),
      lastSuccessfulRefreshAt: timestamp,
      schemaVersion: 1,
      source: "Javno preduzeće za upravljanje morskim dobrom Crne Gore",
      sourceUrl: seaWaterQualitySourceUrl,
    };

    try {
      // History is a separate, atomically-written read model. Persist it before the current
      // snapshot: a later current-snapshot write failure cannot corrupt or truncate retained
      // history, and a later retry deterministically replaces the same round rather than
      // appending a duplicate measurement.
      await writeSeaWaterQualityHistoryCache(historySnapshot, resolvedHistoryCachePath);
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
  return typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
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
