import { dirname } from "node:path";

import { acquireRefreshLock } from "../../../shared/lib/refresh-lock.ts";
import { createCityContext, getActiveCities, supportsCityCapability } from "@/shared/config/cities";
import type { City, CityContext, CityId } from "@/shared/types/city";

import {
  buildCalendarDataRequestBody,
  buildMapDataRequestBody,
  morskodobroCalendarDataUrl,
  morskodobroMapDataUrl,
  parseBudvaSeaWaterQualitySummary,
  parseSeaWaterQualityCalendar,
} from "./budva-sea-water-quality.ts";
import { getSeaWaterQualityCachePath } from "./budva-sea-water-quality-cache.ts";
import { seaWaterQualitySourceUrl } from "./budva-sea-water-quality-refresh.ts";
import type { MorskodobroHttpClient } from "./morskodobro-http-client.ts";
import {
  getSeaWaterQualityCityId,
  getSeaWaterQualityMunicipality,
  type SeaWaterQualitySupportedCityId,
} from "./sea-water-quality-cities.ts";
import {
  getSeaWaterQualityHistoryCachePath,
  mergeSeaWaterQualityHistoryBackfill,
  readSeaWaterQualityHistoryCache,
  writeSeaWaterQualityHistoryCache,
  type SeaWaterQualityHistoryCacheSnapshot,
} from "./sea-water-quality-history-cache.ts";

// JPMD publishes one monitoring season per calendar year; anything outside this window is a typo
// rather than a season we could have data for.
const minimumBackfillYear = 2020;
const maximumBackfillYear = 2100;

type SeaWaterQualityBackfillRoundState = "failed" | "success";

interface SeaWaterQualityBackfillRoundResult {
  acceptedLocations: number;
  errorCode?: string;
  round: number;
  state: SeaWaterQualityBackfillRoundState;
}

interface SeaWaterQualityBackfillCityResult {
  cityId: SeaWaterQualitySupportedCityId;
  errorCode?: string;
  historyPath: string;
  rounds: SeaWaterQualityBackfillRoundResult[];
  state: "already-running" | "failed" | "partial" | "skipped" | "success";
}

interface SeaWaterQualityBackfillResult {
  calendarRounds: number[];
  cities: SeaWaterQualityBackfillCityResult[];
  errorCode?: string;
  rejectedRounds: number[];
  requestedRounds: number[];
  resolvedRounds: number[];
  state: "bad-request" | "failure" | "partial" | "success" | "upstream-unavailable";
  year: number;
}

interface SeaWaterQualityBackfillRequest {
  rounds: readonly number[];
  year: number;
}

interface SeaWaterQualityBackfillDependencies {
  cities?: readonly City[];
  createContext?: (cityId: CityId) => CityContext;
  httpClient: MorskodobroHttpClient;
  now?: () => Date;
  /** Overridable so tests can run against a temporary directory instead of the runtime cache. */
  resolveCachePath?: (cityId: SeaWaterQualitySupportedCityId) => string;
  resolveHistoryCachePath?: (cityId: SeaWaterQualitySupportedCityId) => string;
}

// Validates the caller's requested rounds against the official calendar. Rejects anything that is
// not a positive integer, is absent from the calendar, or is newer than the round the site itself
// currently selects. Duplicates are collapsed and the result is ascending so history is written
// oldest-round-first.
function resolveBackfillRounds({
  calendarRounds,
  requestedRounds,
  selectedRound,
}: {
  calendarRounds: readonly number[];
  requestedRounds: readonly number[];
  selectedRound?: number;
}) {
  const available = new Set(calendarRounds);
  const upperBound = selectedRound ?? Math.max(...calendarRounds, 0);
  const seen = new Set<number>();
  const resolved: number[] = [];
  const rejected: number[] = [];

  for (const round of requestedRounds) {
    if (seen.has(round)) continue;
    seen.add(round);

    if (Number.isInteger(round) && round > 0 && available.has(round) && round <= upperBound) {
      resolved.push(round);
    } else {
      rejected.push(round);
    }
  }

  return {
    rejectedRounds: rejected,
    resolvedRounds: resolved.sort((left, right) => left - right),
  };
}

function isValidBackfillYear(year: number) {
  return Number.isInteger(year) && year >= minimumBackfillYear && year <= maximumBackfillYear;
}

function getBackfillCityIds(
  cities: readonly City[] = getActiveCities(),
  createContext: (cityId: CityId) => CityContext = createCityContext,
): SeaWaterQualitySupportedCityId[] {
  return cities
    .filter((city) => city.isActive && supportsCityCapability(city, "seaWaterQuality"))
    .map((city) => getSeaWaterQualityCityId(createContext(city.id)))
    .filter((cityId): cityId is SeaWaterQualitySupportedCityId => cityId !== undefined);
}

// Backfills completed JPMD rounds into the seasonal history snapshots. This writes ONLY history:
// it never touches the current/latest sea-water snapshot, so the public summary keeps reflecting
// the newest normal refresh. One upstream request per (city, round) using the verified
// municipality ids — no undocumented national-fetch shortcut.
async function backfillSeaWaterQualityHistory(
  { rounds: requestedRounds, year }: SeaWaterQualityBackfillRequest,
  {
    cities,
    createContext,
    httpClient,
    now = () => new Date(),
    resolveCachePath = getSeaWaterQualityCachePath,
    resolveHistoryCachePath = getSeaWaterQualityHistoryCachePath,
  }: SeaWaterQualityBackfillDependencies,
): Promise<SeaWaterQualityBackfillResult> {
  const requested = [...requestedRounds];
  const emptyResult = {
    calendarRounds: [],
    cities: [],
    rejectedRounds: requested,
    requestedRounds: requested,
    resolvedRounds: [],
    year,
  };

  if (!isValidBackfillYear(year) || requested.length === 0) {
    return {
      ...emptyResult,
      errorCode: "sea-water-quality-backfill-invalid-request",
      state: "bad-request",
    };
  }

  const calendarBody = await fetchCalendarBody(httpClient);
  if (calendarBody === undefined) {
    return {
      ...emptyResult,
      errorCode: "sea-water-quality-calendar-unavailable",
      state: "upstream-unavailable",
    };
  }
  const calendar = parseSeaWaterQualityCalendar(calendarBody);
  if (!calendar || calendar.rounds.length === 0) {
    return {
      ...emptyResult,
      errorCode: "sea-water-quality-calendar-unrecognized",
      state: "upstream-unavailable",
    };
  }

  const { rejectedRounds, resolvedRounds } = resolveBackfillRounds({
    calendarRounds: calendar.rounds,
    requestedRounds: requested,
    ...(calendar.selectedRound === undefined ? {} : { selectedRound: calendar.selectedRound }),
  });
  const base = {
    calendarRounds: calendar.rounds,
    rejectedRounds,
    requestedRounds: requested,
    resolvedRounds,
    year,
  };
  if (resolvedRounds.length === 0) {
    return {
      ...base,
      cities: [],
      errorCode: "sea-water-quality-backfill-no-valid-rounds",
      state: "bad-request",
    };
  }

  const cityResults: SeaWaterQualityBackfillCityResult[] = [];
  for (const cityId of getBackfillCityIds(cities, createContext)) {
    cityResults.push(
      await backfillCitySeaWaterQualityHistory({
        cachePath: resolveCachePath(cityId),
        cityId,
        historyPath: resolveHistoryCachePath(cityId),
        httpClient,
        now,
        rounds: resolvedRounds,
        year,
      }),
    );
  }

  return { ...base, cities: cityResults, state: aggregateBackfillState(cityResults) };
}

async function backfillCitySeaWaterQualityHistory({
  cachePath,
  cityId,
  historyPath,
  httpClient,
  now,
  rounds,
  year,
}: {
  cachePath: string;
  cityId: SeaWaterQualitySupportedCityId;
  historyPath: string;
  httpClient: MorskodobroHttpClient;
  now: () => Date;
  rounds: readonly number[];
  year: number;
}): Promise<SeaWaterQualityBackfillCityResult> {
  // Reuse the existing per-city refresh lock so a backfill can never interleave with the normal
  // refresh writing the same city's history file.
  const lock = await acquireRefreshLock(dirname(cachePath), {
    lockFileName: `.${cityId}-sea-water-quality-refresh.lock`,
  });
  if (!("release" in lock)) {
    return { cityId, historyPath, rounds: [], state: "already-running" };
  }

  try {
    const previousSnapshot = await readSeaWaterQualityHistoryCache(historyPath);
    // Refuse to touch a newer season: an old-season backfill must never replace newer history.
    if (previousSnapshot?.history && previousSnapshot.history.year > year) {
      return {
        cityId,
        errorCode: "sea-water-quality-backfill-newer-season-present",
        historyPath,
        rounds: [],
        state: "skipped",
      };
    }

    const municipalityId = getSeaWaterQualityMunicipality(cityId)!.municipalityId;
    let history = previousSnapshot?.history;
    const roundResults: SeaWaterQualityBackfillRoundResult[] = [];

    for (const round of rounds) {
      try {
        const body = await httpClient.post(
          morskodobroMapDataUrl,
          buildMapDataRequestBody({ municipalityId, round, year }),
        );
        const parsed = parseBudvaSeaWaterQualitySummary(body, cityId);
        if (!parsed) {
          roundResults.push({
            acceptedLocations: 0,
            errorCode: "sea-water-quality-response-unrecognized",
            round,
            state: "failed",
          });
          continue;
        }
        if (parsed.summary.locations.length === 0) {
          roundResults.push({
            acceptedLocations: 0,
            errorCode: "sea-water-quality-empty-response",
            round,
            state: "failed",
          });
          continue;
        }

        const merged = mergeSeaWaterQualityHistoryBackfill({
          cityId,
          ...(history ? { previous: history } : {}),
          // Trust the round echoed by the payload itself when present; fall back to the requested
          // one. This keeps the stored sourceRound identical to what a normal refresh would store.
          round: parsed.sourceRound ?? round,
          summaryLocations: parsed.summary.locations,
          year,
        });
        const timestamp = now().toISOString();
        const snapshot: SeaWaterQualityHistoryCacheSnapshot = {
          fetchedAt: previousSnapshot?.fetchedAt ?? timestamp,
          history: merged,
          // Backfill is not a "current" refresh: it must not advance the freshness clock that the
          // normal refresh owns. Only a first-ever write seeds these timestamps.
          lastSuccessfulRefreshAt: previousSnapshot?.lastSuccessfulRefreshAt ?? timestamp,
          schemaVersion: 1,
          source: "Javno preduzeće za upravljanje morskim dobrom Crne Gore",
          sourceUrl: seaWaterQualitySourceUrl,
        };

        // Written per round and atomically, so a later round failing cannot roll back the rounds
        // already merged, and a rerun deterministically replaces the same round.
        await writeSeaWaterQualityHistoryCache(snapshot, historyPath);
        history = merged;
        roundResults.push({
          acceptedLocations: parsed.summary.locations.length,
          round,
          state: "success",
        });
      } catch (error) {
        roundResults.push({
          acceptedLocations: 0,
          errorCode: getBackfillErrorCode(error),
          round,
          state: "failed",
        });
      }
    }

    return { cityId, historyPath, rounds: roundResults, state: aggregateRoundState(roundResults) };
  } finally {
    await lock.release();
  }
}

function aggregateRoundState(
  rounds: readonly SeaWaterQualityBackfillRoundResult[],
): SeaWaterQualityBackfillCityResult["state"] {
  if (rounds.length === 0) return "failed";
  if (rounds.every((round) => round.state === "success")) return "success";
  if (rounds.every((round) => round.state === "failed")) return "failed";
  return "partial";
}

function aggregateBackfillState(
  cities: readonly SeaWaterQualityBackfillCityResult[],
): SeaWaterQualityBackfillResult["state"] {
  if (cities.length === 0) return "failure";
  if (cities.every((city) => city.state === "success")) return "success";
  if (cities.every((city) => city.state === "failed")) return "failure";
  return "partial";
}

async function fetchCalendarBody(httpClient: MorskodobroHttpClient) {
  try {
    return await httpClient.post(morskodobroCalendarDataUrl, buildCalendarDataRequestBody());
  } catch {
    return undefined;
  }
}

function getBackfillErrorCode(error: unknown) {
  return typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
    ? error.code
    : "sea-water-quality-backfill-failed";
}

export {
  backfillSeaWaterQualityHistory,
  getBackfillCityIds,
  isValidBackfillYear,
  maximumBackfillYear,
  minimumBackfillYear,
  resolveBackfillRounds,
  type SeaWaterQualityBackfillCityResult,
  type SeaWaterQualityBackfillDependencies,
  type SeaWaterQualityBackfillRequest,
  type SeaWaterQualityBackfillResult,
  type SeaWaterQualityBackfillRoundResult,
};
