import { z } from "zod";

import { env } from "../../../config/env.ts";
import {
  calculateCacheFreshness,
  readJsonCache,
  writeJsonCache,
} from "../../../shared/lib/cache.ts";

import {
  normalizeFlight,
  sortAndDeduplicateFlights,
  type Flight,
  type FlightDirection,
} from "../domain/flight.ts";

const podgoricaFlightsUrl =
  "https://montenegroairports.com/aerodromixs/cache-flights.php?airport=pg";
const defaultPodgoricaFlightsCachePath = env.PODGORICA_FLIGHTS_CACHE_PATH;
const maximumResponseLength = 2_000_000;

const rawFlightSchema = z
  .object({
    Airport: z.string().nullable().optional(),
    EstimatedDateTime: z.string().nullable().optional(),
    FlightNumberIATA: z.string().nullable().optional(),
    FlightType: z.string().nullable().optional(),
    ScheduledDateTime: z.string().nullable().optional(),
    StatusID: z.string().nullable().optional(),
  })
  .passthrough();

const rawFlightsPayloadSchema = z
  .object({
    value: z.array(rawFlightSchema),
  })
  .passthrough();

type FlightCacheState = "fresh" | "stale" | "unavailable";

interface PodgoricaFlightsCacheSnapshot {
  fetchedAt: string;
  flights: Flight[];
  lastRefreshError?: string;
  lastSuccessfulRefreshAt: string;
  parserWarnings: string[];
  schemaVersion: 1;
  sourceUrl: string;
}

interface PodgoricaFlightsHttpResponse {
  contentType: string | null;
  finalUrl: string;
  requestedUrl: string;
  status: number;
  body: string;
}

interface PodgoricaFlightsHttpClient {
  get(url: string): Promise<PodgoricaFlightsHttpResponse>;
}

interface PodgoricaFlightsParseResult {
  flights: Flight[];
  recognized: boolean;
  rejected: number;
  records: number;
  warnings: string[];
}

interface PodgoricaFlightsRefreshResult {
  acceptedFlights: number;
  errorCode?: string;
  retainedPreviousSnapshot: boolean;
  snapshot: PodgoricaFlightsCacheSnapshot | null;
  success: boolean;
  warnings: string[];
}

interface PodgoricaFlightsCacheResult {
  flights: Flight[];
  lastSuccessfulRefreshAt?: string;
  state: FlightCacheState;
}

type FetchImplementation = (
  url: string,
  init: RequestInit,
) => Promise<{
  headers?: { get(name: string): string | null };
  ok: boolean;
  status: number;
  text(): Promise<string>;
  url?: string;
}>;

class PodgoricaFlightsFetchError extends Error {
  readonly code:
    | "podgorica-flights-host-rejected"
    | "podgorica-flights-invalid-content-type"
    | "podgorica-flights-request-failed"
    | "podgorica-flights-response-too-large"
    | "podgorica-flights-timeout";

  constructor(
    code:
      | "podgorica-flights-host-rejected"
      | "podgorica-flights-invalid-content-type"
      | "podgorica-flights-request-failed"
      | "podgorica-flights-response-too-large"
      | "podgorica-flights-timeout",
    message: string,
  ) {
    super(message);
    this.name = "PodgoricaFlightsFetchError";
    this.code = code;
  }
}

function createPodgoricaFlightsHttpClient({
  fetchImplementation = fetch,
  retries = 1,
  timeoutMs = 10_000,
}: {
  fetchImplementation?: FetchImplementation;
  retries?: number;
  timeoutMs?: number;
} = {}): PodgoricaFlightsHttpClient {
  return {
    async get(requestedUrl) {
      assertPodgoricaFlightsUrl(requestedUrl);
      let latestError: PodgoricaFlightsFetchError | undefined;

      for (let attempt = 0; attempt <= retries; attempt += 1) {
        try {
          const response = await fetchImplementation(requestedUrl, {
            headers: {
              Accept: "application/json, text/plain;q=0.9, text/html;q=0.5",
              "User-Agent": "Gradom/0.1 (+https://gradom.me)",
            },
            signal: AbortSignal.timeout(timeoutMs),
          });
          const finalUrl = response.url || requestedUrl;
          assertPodgoricaFlightsUrl(finalUrl);

          if (!response.ok) {
            latestError = new PodgoricaFlightsFetchError(
              "podgorica-flights-request-failed",
              `Aerodrom Podgorica returned HTTP ${response.status}.`,
            );
            if (response.status < 429) break;
            continue;
          }

          const contentType = response.headers?.get("content-type") ?? null;
          if (!isJsonLikeContentType(contentType)) {
            throw new PodgoricaFlightsFetchError(
              "podgorica-flights-invalid-content-type",
              "Aerodrom Podgorica did not return the public flight-feed format.",
            );
          }

          const body = await response.text();
          if (!body.trim()) {
            throw new PodgoricaFlightsFetchError(
              "podgorica-flights-request-failed",
              "Aerodrom Podgorica returned an empty flight feed.",
            );
          }
          if (body.length > maximumResponseLength) {
            throw new PodgoricaFlightsFetchError(
              "podgorica-flights-response-too-large",
              "Aerodrom Podgorica response exceeded the allowed size.",
            );
          }

          return { body, contentType, finalUrl, requestedUrl, status: response.status };
        } catch (error) {
          if (error instanceof PodgoricaFlightsFetchError) {
            latestError = error;
            if (
              error.code === "podgorica-flights-host-rejected" ||
              error.code === "podgorica-flights-invalid-content-type" ||
              error.code === "podgorica-flights-response-too-large"
            ) {
              break;
            }
          } else {
            latestError = new PodgoricaFlightsFetchError(
              error instanceof Error && error.name === "AbortError"
                ? "podgorica-flights-timeout"
                : "podgorica-flights-request-failed",
              error instanceof Error && error.name === "AbortError"
                ? "Aerodrom Podgorica request timed out."
                : "Aerodrom Podgorica request failed.",
            );
          }
        }
      }

      throw (
        latestError ??
        new PodgoricaFlightsFetchError(
          "podgorica-flights-request-failed",
          "Flight-feed request failed.",
        )
      );
    },
  };
}

function parsePodgoricaFlights(payload: string): PodgoricaFlightsParseResult {
  const parsedJson = parseJson(payload);
  if (!parsedJson.success) return parserFailure("podgorica-flights-json-invalid");

  const parsedPayload = rawFlightsPayloadSchema.safeParse(parsedJson.value);
  if (!parsedPayload.success) return parserFailure("podgorica-flights-json-value-missing");

  const flights: Flight[] = [];
  const warnings = new Set<string>();
  let rejected = 0;

  for (const record of parsedPayload.data.value) {
    const direction = getFlightDirection(record.FlightType);
    const scheduled = getAirportLocalDateTime(record.ScheduledDateTime);
    if (!direction) {
      rejected += 1;
      warnings.add("podgorica-flights-record-direction-missing");
      continue;
    }
    if (!scheduled) {
      rejected += 1;
      warnings.add("podgorica-flights-record-scheduled-time-invalid");
      continue;
    }

    const flight = normalizeFlight({
      direction,
      ...(record.FlightNumberIATA ? { flightNumber: record.FlightNumberIATA } : {}),
      location: record.Airport ?? "",
      scheduledDate: scheduled.date,
      scheduledTime: scheduled.time,
      ...(record.StatusID ? { status: record.StatusID } : {}),
    });
    if (flight) flights.push(flight);
    else {
      rejected += 1;
      warnings.add("podgorica-flights-record-location-missing");
    }
  }

  if (parsedPayload.data.value.length > 0 && flights.length === 0) {
    return {
      flights: [],
      recognized: false,
      records: parsedPayload.data.value.length,
      rejected,
      warnings: [...warnings, "podgorica-flights-no-valid-records"],
    };
  }

  return {
    flights: sortAndDeduplicateFlights(flights),
    recognized: true,
    records: parsedPayload.data.value.length,
    rejected,
    warnings: [...warnings],
  };
}

async function refreshPodgoricaFlights({
  cachePath = defaultPodgoricaFlightsCachePath,
  httpClient,
  now = () => new Date(),
}: {
  cachePath?: string;
  httpClient: PodgoricaFlightsHttpClient;
  now?: () => Date;
}): Promise<PodgoricaFlightsRefreshResult> {
  const previous = await readJsonCache<PodgoricaFlightsCacheSnapshot>(cachePath);

  try {
    const response = await httpClient.get(createPodgoricaFlightsUrl());
    const parsed = parsePodgoricaFlights(response.body);
    if (!parsed.recognized) {
      return retainPrevious(previous, "podgorica-flights-parser-failed", parsed.warnings);
    }

    const timestamp = now().toISOString();
    const snapshot: PodgoricaFlightsCacheSnapshot = {
      fetchedAt: timestamp,
      flights: parsed.flights,
      lastSuccessfulRefreshAt: timestamp,
      parserWarnings: parsed.warnings,
      schemaVersion: 1,
      sourceUrl: podgoricaFlightsUrl,
    };
    await writeJsonCache(snapshot, cachePath);

    return {
      acceptedFlights: snapshot.flights.length,
      retainedPreviousSnapshot: false,
      snapshot,
      success: true,
      warnings: snapshot.parserWarnings,
    };
  } catch (error) {
    return retainPrevious(
      previous,
      error instanceof PodgoricaFlightsFetchError ? error.code : "podgorica-flights-refresh-failed",
      [],
    );
  }
}

async function getCachedPodgoricaFlights(
  cachePath = defaultPodgoricaFlightsCachePath,
  now = new Date(),
): Promise<PodgoricaFlightsCacheResult> {
  const snapshot = await readJsonCache<PodgoricaFlightsCacheSnapshot>(cachePath);
  if (!snapshot || !Array.isArray(snapshot.flights)) {
    return { flights: [], state: "unavailable" as const };
  }

  const state: FlightCacheState = calculateCacheFreshness(
    new Date(snapshot.fetchedAt),
    now,
    env.PODGORICA_FLIGHTS_CACHE_FRESHNESS_MINUTES,
  );
  return {
    flights: snapshot.flights,
    lastSuccessfulRefreshAt: snapshot.lastSuccessfulRefreshAt,
    state,
  };
}

function createPodgoricaFlightsUrl() {
  return podgoricaFlightsUrl;
}

function assertPodgoricaFlightsUrl(value: string) {
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      !["montenegroairports.com", "www.montenegroairports.com"].includes(url.hostname) ||
      url.pathname !== "/aerodromixs/cache-flights.php" ||
      url.searchParams.get("airport") !== "pg"
    ) {
      throw new Error("unapproved host or path");
    }
  } catch {
    throw new PodgoricaFlightsFetchError(
      "podgorica-flights-host-rejected",
      "Podgorica Airport flight-feed URL is not allowed.",
    );
  }
}

function getFlightDirection(value: string | null | undefined): FlightDirection | undefined {
  const normalized = value?.trim().toLocaleLowerCase("en");
  if (normalized === "arrival") return "arrival";
  if (normalized === "departure") return "departure";
  return undefined;
}

function getAirportLocalDateTime(value: string | null | undefined) {
  const match = value?.trim().match(/^(\d{4}-\d{2}-\d{2})[T\s](\d{1,2}:\d{2})/);
  if (!match) return undefined;

  return { date: match[1], time: normalizeTime(match[2]) };
}

function normalizeTime(value: string) {
  const time = value.match(/^(\d{1,2}):(\d{2})$/)?.slice(1);
  return time ? `${time[0].padStart(2, "0")}:${time[1]}` : "";
}

function isJsonLikeContentType(contentType: string | null) {
  const normalized = contentType?.toLocaleLowerCase("en") ?? "";
  return (
    normalized.includes("application/json") ||
    normalized.includes("text/plain") ||
    normalized.includes("text/html")
  );
}

function parseJson(value: string): { success: true; value: unknown } | { success: false } {
  try {
    return { success: true, value: JSON.parse(value) };
  } catch {
    return { success: false };
  }
}

function parserFailure(warning: string): PodgoricaFlightsParseResult {
  return { flights: [], recognized: false, records: 0, rejected: 0, warnings: [warning] };
}

function retainPrevious(
  previous: PodgoricaFlightsCacheSnapshot | null,
  errorCode: string,
  warnings: string[],
): PodgoricaFlightsRefreshResult {
  return {
    acceptedFlights: previous?.flights.length ?? 0,
    errorCode,
    retainedPreviousSnapshot: Boolean(previous),
    snapshot: previous ? { ...previous, lastRefreshError: errorCode } : null,
    success: false,
    warnings,
  };
}

export {
  assertPodgoricaFlightsUrl,
  createPodgoricaFlightsHttpClient,
  createPodgoricaFlightsUrl,
  defaultPodgoricaFlightsCachePath,
  getCachedPodgoricaFlights,
  parsePodgoricaFlights,
  podgoricaFlightsUrl,
  refreshPodgoricaFlights,
  PodgoricaFlightsFetchError,
  type FlightCacheState,
  type PodgoricaFlightsCacheSnapshot,
  type PodgoricaFlightsCacheResult,
  type PodgoricaFlightsHttpClient,
  type PodgoricaFlightsRefreshResult,
};
