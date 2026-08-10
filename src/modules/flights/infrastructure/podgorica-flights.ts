import { dirname, join } from "node:path";

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
import {
  airportFlightsSources,
  createAirportFlightsUrl,
  getAirportFlightsSource,
  getAirportFlightsSourceBySelector,
  isFlightsSupportedCityId,
  montenegroAirportsFeedUrl,
  type FlightsSupportedCityId,
} from "./airport-flights-config.ts";

const defaultPodgoricaFlightsCachePath = env.PODGORICA_FLIGHTS_CACHE_PATH;
const maximumPublicFlightsSnapshotAgeMinutes = 6 * 60;
const maximumResponseLength = 2_000_000;
const maximumDiagnosticBodyPreviewLength = 200;

// The public montenegroairports.com feed is observably intermittent — live checks during
// investigation of the cold-start failure showed several consecutive HTTP 500 responses
// followed by a normal 200 within seconds. A single retry (the old behavior) is not enough to
// survive an outage of that shape on a fresh deployment with no prior cache to fall back on.
// 4 retries = 5 total attempts, with exponential backoff capped at 4s: gaps of 500ms, 1s, 2s,
// 4s (7.5s of backoff total). Bounded and short enough for a one-time collector run at server
// startup or a scheduled refresh, not a per-visitor-request path.
const defaultFlightsHttpRetries = 4;
const baseRetryDelayMs = 500;
const maximumRetryDelayMs = 4_000;

function getRetryDelayMs(attemptNumber: number) {
  return Math.min(baseRetryDelayMs * 2 ** (attemptNumber - 1), maximumRetryDelayMs);
}

type SleepFunction = (delayMs: number) => Promise<void>;

function defaultSleep(delayMs: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

// Podgorica keeps its legacy configured cache path for production compatibility. Every additional
// approved airport gets a city-named sibling, so each airport owns a separate atomic snapshot
// without needing another environment variable.
function getFlightsCachePath(cityId: FlightsSupportedCityId) {
  return cityId === "podgorica"
    ? defaultPodgoricaFlightsCachePath
    : join(dirname(defaultPodgoricaFlightsCachePath), `${cityId}-flights.json`);
}

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

const rawTivatFlightSchema = z
  .object({
    BrojLeta: z.string().nullable().optional(),
    Datum: z.string().nullable().optional(),
    Grad: z.string().nullable().optional(),
    Kompanija: z.string().nullable().optional(),
    KompanijaNaziv: z.string().nullable().optional(),
    Planirano: z.string().nullable().optional(),
    StatusMN: z.string().nullable().optional(),
    TipLeta: z.string().nullable().optional(),
  })
  .passthrough();

const rawTivatFlightsPayloadSchema = z.array(rawTivatFlightSchema);

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
  attemptCount?: number;
  contentType: string | null;
  finalUrl: string;
  requestedUrl: string;
  status: number;
  body: string;
}

interface PodgoricaFlightsHttpClient {
  get(url: string): Promise<PodgoricaFlightsHttpResponse>;
}

type PodgoricaFlightsRequestFailureCategory =
  | "connection-reset"
  | "dns"
  | "http-status"
  | "invalid-url"
  | "redirect"
  | "timeout"
  | "tls"
  | "unknown";

type PodgoricaFlightsDiagnosticEmitter = (payload: Record<string, unknown>) => void;

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
  body?: ReadableStream<Uint8Array> | null;
  headers?: { get(name: string): string | null };
  ok: boolean;
  status: number;
  text(): Promise<string>;
  url?: string;
}>;

class PodgoricaFlightsFetchError extends Error {
  readonly code:
    | "airport-flights-host-rejected"
    | "airport-flights-invalid-content-type"
    | "airport-flights-request-failed"
    | "airport-flights-response-too-large"
    | "airport-flights-timeout";
  readonly elapsedMs?: number;
  readonly attemptCount?: number;
  readonly failureCategory: PodgoricaFlightsRequestFailureCategory;
  readonly finalHostname?: string;
  readonly httpStatus?: number;
  readonly responseBodyPreview?: string;
  readonly responseContentLength?: number;
  readonly responseContentType?: string;
  readonly upstreamHostname: string;

  constructor(
    code:
      | "airport-flights-host-rejected"
      | "airport-flights-invalid-content-type"
      | "airport-flights-request-failed"
      | "airport-flights-response-too-large"
      | "airport-flights-timeout",
    message: string,
    {
      attemptCount,
      elapsedMs,
      failureCategory = "unknown",
      finalHostname,
      httpStatus,
      responseBodyPreview,
      responseContentLength,
      responseContentType,
      upstreamHostname = "montenegroairports.com",
    }: {
      attemptCount?: number;
      elapsedMs?: number;
      failureCategory?: PodgoricaFlightsRequestFailureCategory;
      finalHostname?: string;
      httpStatus?: number;
      responseBodyPreview?: string;
      responseContentLength?: number;
      responseContentType?: string;
      upstreamHostname?: string;
    } = {},
  ) {
    super(message);
    this.name = "PodgoricaFlightsFetchError";
    this.code = code;
    this.attemptCount = attemptCount;
    this.elapsedMs = elapsedMs;
    this.failureCategory = failureCategory;
    this.finalHostname = finalHostname;
    this.httpStatus = httpStatus;
    this.responseBodyPreview = responseBodyPreview;
    this.responseContentLength = responseContentLength;
    this.responseContentType = responseContentType;
    this.upstreamHostname = upstreamHostname;
  }
}

function createPodgoricaFlightsHttpClient({
  fetchImplementation = fetch,
  onRetry = emitPodgoricaFlightsDiagnostic,
  retries = defaultFlightsHttpRetries,
  sleep = defaultSleep,
  timeoutMs = 10_000,
}: {
  fetchImplementation?: FetchImplementation;
  onRetry?: PodgoricaFlightsDiagnosticEmitter;
  retries?: number;
  sleep?: SleepFunction;
  timeoutMs?: number;
} = {}): PodgoricaFlightsHttpClient {
  return {
    async get(requestedUrl) {
      const upstreamHostname = getUrlHostname(requestedUrl) ?? "unknown";
      try {
        assertPodgoricaFlightsUrl(requestedUrl);
      } catch (error) {
        throw toRequestFailure(error, {
          elapsedMs: 0,
          failureCategory: "invalid-url",
          upstreamHostname,
        });
      }
      let latestError: PodgoricaFlightsFetchError | undefined;
      const requestStartedAt = Date.now();

      for (let attempt = 0; attempt <= retries; attempt += 1) {
        try {
          const response = await fetchImplementation(requestedUrl, {
            headers: {
              Accept: "application/json, text/plain;q=0.9, text/html;q=0.5",
              "User-Agent": "Gradom/0.1 (+https://gradom.me)",
            },
            method: "GET",
            redirect: "follow",
            signal: AbortSignal.timeout(timeoutMs),
          });
          const finalUrl = response.url || requestedUrl;
          const finalHostname = getUrlHostname(finalUrl);
          try {
            assertPodgoricaFlightsUrl(finalUrl);
          } catch (error) {
            throw toRequestFailure(error, {
              elapsedMs: Date.now() - requestStartedAt,
              failureCategory: "redirect",
              finalHostname,
              upstreamHostname,
            });
          }

          if (!response.ok) {
            const responseMetadata = await getFailureResponseMetadata(response);
            latestError = new PodgoricaFlightsFetchError(
              "airport-flights-request-failed",
              `Airport flight feed returned HTTP ${response.status}.`,
              {
                attemptCount: attempt + 1,
                elapsedMs: Date.now() - requestStartedAt,
                failureCategory: "http-status",
                finalHostname,
                httpStatus: response.status,
                ...responseMetadata,
                upstreamHostname,
              },
            );
            if (!isRetryableHttpStatus(response.status) || attempt === retries) break;
            await emitRetryDiagnosticAndWait({
              attempt,
              error: latestError,
              onRetry,
              retries,
              sleep,
            });
            continue;
          }

          const contentType = response.headers?.get("content-type") ?? null;
          if (!isJsonLikeContentType(contentType)) {
            throw new PodgoricaFlightsFetchError(
              "airport-flights-invalid-content-type",
              "Airport flight feed did not return the expected public format.",
              {
                attemptCount: attempt + 1,
                finalHostname,
                httpStatus: response.status,
                responseContentLength: getResponseContentLength(
                  response.headers?.get("content-length"),
                ),
                ...(contentType ? { responseContentType: contentType } : {}),
                upstreamHostname,
              },
            );
          }

          const body = await response.text();
          if (!body.trim()) {
            throw new PodgoricaFlightsFetchError(
              "airport-flights-request-failed",
              "Airport flight feed returned an empty response.",
              {
                attemptCount: attempt + 1,
                finalHostname,
                httpStatus: response.status,
                responseContentLength: getResponseContentLength(
                  response.headers?.get("content-length"),
                ),
                ...(contentType ? { responseContentType: contentType } : {}),
                upstreamHostname,
              },
            );
          }
          if (body.length > maximumResponseLength) {
            throw new PodgoricaFlightsFetchError(
              "airport-flights-response-too-large",
              "Airport flight-feed response exceeded the allowed size.",
              {
                attemptCount: attempt + 1,
                finalHostname,
                httpStatus: response.status,
                responseContentLength: getResponseContentLength(
                  response.headers?.get("content-length"),
                ),
                ...(contentType ? { responseContentType: contentType } : {}),
                upstreamHostname,
              },
            );
          }

          return {
            attemptCount: attempt + 1,
            body,
            contentType,
            finalUrl,
            requestedUrl,
            status: response.status,
          };
        } catch (error) {
          if (error instanceof PodgoricaFlightsFetchError) {
            latestError = withRequestElapsedTime(error, Date.now() - requestStartedAt);
            if (
              error.code === "airport-flights-host-rejected" ||
              error.code === "airport-flights-invalid-content-type" ||
              error.code === "airport-flights-response-too-large"
            ) {
              break;
            }
          } else {
            latestError = new PodgoricaFlightsFetchError(
              isTimeoutError(error) ? "airport-flights-timeout" : "airport-flights-request-failed",
              isTimeoutError(error)
                ? "Airport flight-feed request timed out."
                : "Airport flight-feed request failed.",
              {
                attemptCount: attempt + 1,
                elapsedMs: Date.now() - requestStartedAt,
                failureCategory: classifyRequestFailure(error),
                upstreamHostname,
              },
            );
          }
          // Network/timeout failures (unlike the terminal codes above) are transient and
          // retryable — mirrors the HTTP-status branch's retry decision, including the same
          // backoff delay, which this path previously skipped entirely (it used to retry
          // immediately with no gap at all).
          if (attempt === retries) break;
          await emitRetryDiagnosticAndWait({
            attempt,
            error: latestError,
            onRetry,
            retries,
            sleep,
          });
        }
      }

      throw (
        latestError ??
        new PodgoricaFlightsFetchError(
          "airport-flights-request-failed",
          "Flight-feed request failed.",
          {
            elapsedMs: Date.now() - requestStartedAt,
            attemptCount: retries + 1,
            failureCategory: "unknown",
            upstreamHostname,
          },
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

function parseTivatFlights(payload: string): PodgoricaFlightsParseResult {
  const parsedJson = parseJson(payload);
  if (!parsedJson.success) return parserFailure("tivat-flights-json-invalid");

  const parsedPayload = rawTivatFlightsPayloadSchema.safeParse(parsedJson.value);
  if (!parsedPayload.success) return parserFailure("tivat-flights-json-array-missing");

  const flights: Flight[] = [];
  const warnings = new Set<string>();
  let rejected = 0;

  for (const record of parsedPayload.data) {
    const direction = getTivatFlightDirection(record.TipLeta);
    const scheduled = getTivatAirportLocalDateTime(record.Datum, record.Planirano);
    if (!direction) {
      rejected += 1;
      warnings.add("tivat-flights-record-direction-missing");
      continue;
    }
    if (!scheduled) {
      rejected += 1;
      warnings.add("tivat-flights-record-scheduled-time-invalid");
      continue;
    }

    const flightNumber = getTivatFlightNumber(record.Kompanija, record.BrojLeta);
    const flight = normalizeFlight({
      ...(record.KompanijaNaziv ? { airline: record.KompanijaNaziv } : {}),
      direction,
      ...(flightNumber ? { flightNumber } : {}),
      location: record.Grad ?? "",
      scheduledDate: scheduled.date,
      scheduledTime: scheduled.time,
      ...(record.StatusMN ? { status: record.StatusMN } : {}),
    });
    if (flight) flights.push(flight);
    else {
      rejected += 1;
      warnings.add("tivat-flights-record-location-missing");
    }
  }

  if (parsedPayload.data.length > 0 && flights.length === 0) {
    return {
      flights: [],
      recognized: false,
      records: parsedPayload.data.length,
      rejected,
      warnings: [...warnings, "tivat-flights-no-valid-records"],
    };
  }

  return {
    flights: sortAndDeduplicateFlights(flights),
    recognized: true,
    records: parsedPayload.data.length,
    rejected,
    warnings: [...warnings],
  };
}

function parseAirportFlights(cityId: FlightsSupportedCityId, payload: string) {
  return getAirportFlightsSource(cityId).parserKind === "tivat"
    ? parseTivatFlights(payload)
    : parsePodgoricaFlights(payload);
}

// Error codes retainPrevious() can receive that are not backed by a PodgoricaFlightsFetchError
// instance — parsePodgoricaFlights rejects structurally valid-but-unusable upstream content
// (an unrecognized payload shape, or a well-formed-but-empty one) before any
// PodgoricaFlightsFetchError is constructed, and a cache-write failure or an unclassified
// exception are pipeline faults, not upstream feed behavior at all. Named here (not inline
// string literals) so the classification helper below and the code that actually produces them
// cannot silently drift apart.
const podgoricaFlightsParserFailedErrorCode = "airport-flights-parser-failed";
const podgoricaFlightsEmptyResponseErrorCode = "airport-flights-empty-response";
const podgoricaFlightsCacheWriteFailedErrorCode = "airport-flights-cache-write-failed";
const podgoricaFlightsRefreshFailedErrorCode = "airport-flights-refresh-failed";

// One conscious true/false decision per PodgoricaFlightsFetchError code, not a bare string list:
// Record<PodgoricaFlightsFetchError["code"], boolean> forces this object to have a key for every
// member of that closed union, so adding a new FetchError code without updating this file is a
// compile error rather than a silent classification gap.
const podgoricaFlightsFetchErrorIsUpstream: Record<PodgoricaFlightsFetchError["code"], boolean> = {
  "airport-flights-host-rejected": true,
  "airport-flights-invalid-content-type": true,
  "airport-flights-request-failed": true,
  "airport-flights-response-too-large": true,
  "airport-flights-timeout": true,
};

// Whether a failed refreshPodgoricaFlights() result reflects the upstream feed's own behavior
// (safe to report as a routine, non-alerting outcome) rather than a fault in our own pipeline
// (a cache write that threw, or an exception that isn't a PodgoricaFlightsFetchError at all —
// both must keep surfacing as real failures). Used by the refresh-endpoint status mapping in
// provider-refresh-result.ts instead of that file keeping its own separate, hardcoded list.
function isPodgoricaFlightsUpstreamErrorCode(errorCode: string): boolean {
  if (
    errorCode === podgoricaFlightsParserFailedErrorCode ||
    errorCode === podgoricaFlightsEmptyResponseErrorCode
  ) {
    return true;
  }
  return (
    Object.hasOwn(podgoricaFlightsFetchErrorIsUpstream, errorCode) &&
    podgoricaFlightsFetchErrorIsUpstream[errorCode as PodgoricaFlightsFetchError["code"]]
  );
}

async function refreshPodgoricaFlights({
  cachePath,
  cacheWriter = writeJsonCache,
  cityId = "podgorica",
  diagnostic = emitPodgoricaFlightsDiagnostic,
  httpClient,
  now = () => new Date(),
}: {
  cachePath?: string;
  cacheWriter?: (snapshot: PodgoricaFlightsCacheSnapshot, destination: string) => Promise<void>;
  cityId?: FlightsSupportedCityId;
  diagnostic?: PodgoricaFlightsDiagnosticEmitter;
  httpClient: PodgoricaFlightsHttpClient;
  now?: () => Date;
}): Promise<PodgoricaFlightsRefreshResult> {
  const resolvedCachePath = cachePath ?? getFlightsCachePath(cityId);
  const requestUrl = createPodgoricaFlightsUrl(cityId);
  const previous = await readJsonCache<PodgoricaFlightsCacheSnapshot>(resolvedCachePath);

  try {
    const response = await httpClient.get(requestUrl);
    const parsed = parseAirportFlights(cityId, response.body);
    if (!parsed.recognized) {
      emitPodgoricaFlightsFailureDiagnostic({
        attemptCount: response.attemptCount ?? 1,
        diagnostic,
        diagnosticNow: now(),
        errorCode: podgoricaFlightsParserFailedErrorCode,
        failureCategory: "response-format",
        finalHostname: getUrlHostname(response.finalUrl),
        httpStatus: response.status,
        previous,
        responseMetadata: getSuccessfulResponseDiagnosticMetadata(response),
        upstreamHostname: getUrlHostname(response.requestedUrl) ?? "unknown",
      });
      return retainPrevious(previous, podgoricaFlightsParserFailedErrorCode, parsed.warnings);
    }

    // A structurally valid response reporting zero flights (an empty "value" array, distinct
    // from "records present but all rejected" above) is treated the same as an unrecognized one
    // when a non-empty previous snapshot exists — the montenegroairports.com feed is observably
    // intermittent (it alternates between real data and empty/error responses within seconds),
    // so an empty-but-well-formed reply must not silently wipe out a good cache. No previous
    // snapshot, or a previous snapshot that was itself empty, still writes through normally —
    // first-ever collection and a genuinely quiet schedule both proceed as before.
    if (parsed.flights.length === 0 && previous && previous.flights.length > 0) {
      emitPodgoricaFlightsFailureDiagnostic({
        attemptCount: response.attemptCount ?? 1,
        diagnostic,
        diagnosticNow: now(),
        errorCode: podgoricaFlightsEmptyResponseErrorCode,
        failureCategory: "response-format",
        finalHostname: getUrlHostname(response.finalUrl),
        httpStatus: response.status,
        previous,
        responseMetadata: getSuccessfulResponseDiagnosticMetadata(response),
        upstreamHostname: getUrlHostname(response.requestedUrl) ?? "unknown",
      });
      return retainPrevious(previous, podgoricaFlightsEmptyResponseErrorCode, parsed.warnings);
    }

    const timestamp = now().toISOString();
    const snapshot: PodgoricaFlightsCacheSnapshot = {
      fetchedAt: timestamp,
      flights: parsed.flights,
      lastSuccessfulRefreshAt: timestamp,
      parserWarnings: parsed.warnings,
      schemaVersion: 1,
      sourceUrl: requestUrl,
    };
    try {
      await cacheWriter(snapshot, resolvedCachePath);
    } catch {
      return retainPrevious(previous, podgoricaFlightsCacheWriteFailedErrorCode, []);
    }

    return {
      acceptedFlights: snapshot.flights.length,
      retainedPreviousSnapshot: false,
      snapshot,
      success: true,
      warnings: snapshot.parserWarnings,
    };
  } catch (error) {
    if (error instanceof PodgoricaFlightsFetchError) {
      emitPodgoricaFlightsFailureDiagnostic({
        attemptCount: error.attemptCount ?? 1,
        diagnostic,
        diagnosticNow: now(),
        elapsedMs: error.elapsedMs ?? 0,
        errorCode: error.code,
        failureCategory: error.failureCategory,
        finalHostname: error.finalHostname,
        httpStatus: error.httpStatus,
        previous,
        responseMetadata: {
          responseBodyPreview: error.responseBodyPreview,
          responseContentLength: error.responseContentLength,
          responseContentType: error.responseContentType,
        },
        upstreamHostname: error.upstreamHostname,
      });
    }
    return retainPrevious(
      previous,
      error instanceof PodgoricaFlightsFetchError
        ? error.code
        : podgoricaFlightsRefreshFailedErrorCode,
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

  const fetchedAt = new Date(snapshot.fetchedAt);
  const freshness = calculateCacheFreshness(
    fetchedAt,
    now,
    env.PODGORICA_FLIGHTS_CACHE_FRESHNESS_MINUTES,
  );
  const state: FlightCacheState =
    freshness === "stale" &&
    now.getTime() - fetchedAt.getTime() > maximumPublicFlightsSnapshotAgeMinutes * 60_000
      ? "unavailable"
      : freshness;

  return {
    flights: snapshot.flights,
    lastSuccessfulRefreshAt: snapshot.lastSuccessfulRefreshAt,
    state,
  };
}

function createPodgoricaFlightsUrl(cityId: FlightsSupportedCityId = "podgorica") {
  return createAirportFlightsUrl(cityId);
}

function assertPodgoricaFlightsUrl(value: string) {
  try {
    const url = new URL(value);
    const airportCode = url.searchParams.get("airport");
    if (
      url.protocol !== "https:" ||
      !["montenegroairports.com", "www.montenegroairports.com"].includes(url.hostname) ||
      url.pathname !== "/aerodromixs/cache-flights.php" ||
      !airportCode ||
      !getAirportFlightsSourceBySelector(airportCode)
    ) {
      throw new Error("unapproved host or path");
    }
  } catch {
    throw new PodgoricaFlightsFetchError(
      "airport-flights-host-rejected",
      "Airport flight-feed URL is not allowed.",
    );
  }
}

function emitPodgoricaFlightsDiagnostic(payload: Record<string, unknown>) {
  console.error(JSON.stringify(payload));
}

function getUrlHostname(value: string) {
  try {
    return new URL(value).hostname;
  } catch {
    return undefined;
  }
}

function toRequestFailure(
  error: unknown,
  metadata: {
    elapsedMs: number;
    failureCategory: PodgoricaFlightsRequestFailureCategory;
    finalHostname?: string;
    upstreamHostname: string;
  },
) {
  if (error instanceof PodgoricaFlightsFetchError) {
    return new PodgoricaFlightsFetchError(error.code, error.message, {
      ...metadata,
      httpStatus: error.httpStatus,
    });
  }

  return new PodgoricaFlightsFetchError(
    "airport-flights-request-failed",
    "Airport flight-feed request URL is not allowed.",
    metadata,
  );
}

function withRequestElapsedTime(error: PodgoricaFlightsFetchError, elapsedMs: number) {
  return new PodgoricaFlightsFetchError(error.code, error.message, {
    attemptCount: error.attemptCount,
    elapsedMs,
    failureCategory: error.failureCategory,
    finalHostname: error.finalHostname,
    httpStatus: error.httpStatus,
    responseBodyPreview: error.responseBodyPreview,
    responseContentLength: error.responseContentLength,
    responseContentType: error.responseContentType,
    upstreamHostname: error.upstreamHostname,
  });
}

function classifyRequestFailure(error: unknown): PodgoricaFlightsRequestFailureCategory {
  if (isTimeoutError(error)) return "timeout";

  const code = getNestedErrorCode(error);
  if (code === "ENOTFOUND" || code === "EAI_AGAIN" || code === "ENODATA") return "dns";
  if (
    code === "CERT_HAS_EXPIRED" ||
    code === "DEPTH_ZERO_SELF_SIGNED_CERT" ||
    code === "ERR_TLS_CERT_ALTNAME_INVALID" ||
    code === "EPROTO" ||
    code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE"
  ) {
    return "tls";
  }
  if (code === "ECONNRESET" || code === "EPIPE" || code === "UND_ERR_SOCKET") {
    return "connection-reset";
  }
  return "unknown";
}

function isTimeoutError(error: unknown) {
  const code = getNestedErrorCode(error);
  return (
    (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) ||
    code === "ETIMEDOUT" ||
    code === "UND_ERR_CONNECT_TIMEOUT" ||
    code === "UND_ERR_HEADERS_TIMEOUT" ||
    code === "UND_ERR_BODY_TIMEOUT"
  );
}

function getNestedErrorCode(error: unknown): string | undefined {
  let current = error;
  for (let depth = 0; depth < 3; depth += 1) {
    if (typeof current !== "object" || current === null) return undefined;
    if ("code" in current && typeof current.code === "string") return current.code;
    if (!("cause" in current)) return undefined;
    current = current.cause;
  }
  return undefined;
}

function getFlightDirection(value: string | null | undefined): FlightDirection | undefined {
  const normalized = value?.trim().toLocaleLowerCase("en");
  if (normalized === "arrival") return "arrival";
  if (normalized === "departure") return "departure";
  return undefined;
}

function getTivatFlightDirection(value: string | null | undefined): FlightDirection | undefined {
  const normalized = value?.trim().toLocaleUpperCase("en");
  if (normalized === "I") return "arrival";
  if (normalized === "O") return "departure";
  return undefined;
}

function getAirportLocalDateTime(value: string | null | undefined) {
  const match = value?.trim().match(/^(\d{4}-\d{2}-\d{2})[T\s](\d{1,2}:\d{2})/);
  if (!match) return undefined;

  return { date: match[1], time: normalizeTime(match[2]) };
}

function getTivatAirportLocalDateTime(
  dateValue: string | null | undefined,
  timeValue: string | null | undefined,
) {
  const dateMatch = dateValue?.trim().match(/^(\d{2})-(\d{2})-(\d{4})$/);
  const timeMatch = timeValue?.trim().match(/^(\d{2})(\d{2})$/);
  if (!dateMatch || !timeMatch) return undefined;

  const [, dayText, monthText, yearText] = dateMatch;
  const [, hourText, minuteText] = timeMatch;
  const day = Number(dayText);
  const month = Number(monthText);
  const year = Number(yearText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day ||
    hour > 23 ||
    minute > 59
  ) {
    return undefined;
  }

  return {
    date: `${yearText}-${monthText}-${dayText}`,
    time: `${hourText}:${minuteText}`,
  };
}

function getTivatFlightNumber(
  carrier: string | null | undefined,
  number: string | null | undefined,
) {
  const normalizedCarrier = carrier?.trim();
  const normalizedNumber = number?.trim();
  if (!normalizedCarrier) return normalizedNumber;
  if (!normalizedNumber) return normalizedCarrier;
  return normalizedNumber.startsWith(normalizedCarrier)
    ? normalizedNumber
    : `${normalizedCarrier} ${normalizedNumber}`;
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

async function getFailureResponseMetadata(
  response: Awaited<ReturnType<FetchImplementation>>,
): Promise<{
  responseBodyPreview?: string;
  responseContentLength?: number;
  responseContentType?: string;
}> {
  const responseContentType = response.headers?.get("content-type") ?? null;
  const responseContentLength = getResponseContentLength(response.headers?.get("content-length"));
  const responseMetadata = {
    ...(responseContentLength !== undefined ? { responseContentLength } : {}),
    ...(responseContentType ? { responseContentType } : {}),
  };

  if (!response.body || !isDiagnosticPreviewContentType(responseContentType)) {
    return responseMetadata;
  }

  try {
    const reader = response.body.getReader();
    try {
      const chunk = await reader.read();
      if (chunk.done || !chunk.value) return responseMetadata;

      const responseBodyPreview = new TextDecoder()
        .decode(chunk.value)
        .slice(0, maximumDiagnosticBodyPreviewLength);
      return responseBodyPreview ? { ...responseMetadata, responseBodyPreview } : responseMetadata;
    } finally {
      void reader.cancel().catch(() => {});
    }
  } catch {
    return responseMetadata;
  }
}

function getSuccessfulResponseDiagnosticMetadata(response: PodgoricaFlightsHttpResponse) {
  return {
    responseBodyPreview: isDiagnosticPreviewContentType(response.contentType)
      ? response.body.slice(0, maximumDiagnosticBodyPreviewLength)
      : undefined,
    responseContentLength: new TextEncoder().encode(response.body).byteLength,
    ...(response.contentType ? { responseContentType: response.contentType } : {}),
  };
}

function getResponseContentLength(value: string | null | undefined) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

function isDiagnosticPreviewContentType(contentType: string | null) {
  const normalized = contentType?.toLocaleLowerCase("en") ?? "";
  return (
    normalized.startsWith("text/") ||
    normalized.startsWith("application/json") ||
    normalized.startsWith("application/problem+json")
  );
}

function emitPodgoricaFlightsFailureDiagnostic({
  attemptCount,
  diagnostic,
  diagnosticNow,
  elapsedMs,
  errorCode,
  failureCategory,
  finalHostname,
  httpStatus,
  previous,
  responseMetadata,
  upstreamHostname,
}: {
  attemptCount: number;
  diagnostic: PodgoricaFlightsDiagnosticEmitter;
  diagnosticNow: Date;
  elapsedMs?: number;
  errorCode: string;
  failureCategory: PodgoricaFlightsRequestFailureCategory | "response-format";
  finalHostname?: string;
  httpStatus?: number;
  previous: PodgoricaFlightsCacheSnapshot | null;
  responseMetadata: {
    responseBodyPreview?: string;
    responseContentLength?: number;
    responseContentType?: string;
  };
  upstreamHostname: string;
}) {
  diagnostic({
    totalAttemptCount: attemptCount,
    errorCode,
    event: "airport-flights-request-failed",
    failureCategory,
    failureType: getFailureType(failureCategory),
    finalState: "failed",
    ...(elapsedMs !== undefined ? { elapsedMs } : {}),
    ...(finalHostname ? { finalHostname } : {}),
    ...(httpStatus !== undefined ? { httpStatus } : {}),
    provider: "montenegro-airports-flights",
    ...getRetainedSnapshotDiagnostic(previous, diagnosticNow),
    retryCountPerformed: Math.max(0, attemptCount - 1),
    ...(responseMetadata.responseBodyPreview
      ? { responseBodyPreview: responseMetadata.responseBodyPreview }
      : {}),
    ...(responseMetadata.responseContentLength !== undefined
      ? { responseContentLength: responseMetadata.responseContentLength }
      : {}),
    ...(responseMetadata.responseContentType
      ? { responseContentType: responseMetadata.responseContentType }
      : {}),
    upstreamHostname,
  });
}

function getFailureType(
  failureCategory: PodgoricaFlightsRequestFailureCategory | "response-format",
) {
  if (failureCategory === "http-status") return "http";
  if (failureCategory === "timeout") return "timeout";
  if (failureCategory === "response-format") return "parser";
  return "network";
}

// 429 is the one 4xx status the existing architecture already treats as transient (rate
// limiting); every other 4xx is a permanent client-side error and is never retried. Every 5xx is
// retried — a third-party server error is assumed transient rather than allowlisting specific
// codes, matching how the upstream has actually failed (plain 500s with an empty body).
function isRetryableHttpStatus(status: number) {
  return status === 429 || (status >= 500 && status < 600);
}

async function emitRetryDiagnosticAndWait({
  attempt,
  error,
  onRetry,
  retries,
  sleep,
}: {
  attempt: number;
  error: PodgoricaFlightsFetchError | undefined;
  onRetry: PodgoricaFlightsDiagnosticEmitter;
  retries: number;
  sleep: SleepFunction;
}) {
  const delayMs = getRetryDelayMs(attempt + 1);
  onRetry({
    attemptNumber: attempt + 1,
    delayMs,
    ...(error?.code ? { errorCode: error.code } : {}),
    event: "airport-flights-retry-scheduled",
    ...(error?.failureCategory ? { failureCategory: error.failureCategory } : {}),
    ...(error?.httpStatus !== undefined ? { httpStatus: error.httpStatus } : {}),
    nextAttemptNumber: attempt + 2,
    provider: "montenegro-airports-flights",
    totalAttempts: retries + 1,
  });
  await sleep(delayMs);
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

function getRetainedSnapshotDiagnostic(previous: PodgoricaFlightsCacheSnapshot | null, now: Date) {
  const fetchedAt = previous ? new Date(previous.fetchedAt) : undefined;
  const retainedSnapshotAgeMs =
    fetchedAt && !Number.isNaN(fetchedAt.getTime())
      ? Math.max(0, now.getTime() - fetchedAt.getTime())
      : undefined;

  return {
    retainedPreviousSnapshot: Boolean(previous),
    retainedRecordCount: previous?.flights.length ?? 0,
    retainedSnapshotAgeMs: retainedSnapshotAgeMs ?? null,
  };
}

const assertAirportFlightsUrl = assertPodgoricaFlightsUrl;
const createAirportFlightsHttpClient = createPodgoricaFlightsHttpClient;
const emitAirportFlightsDiagnostic = emitPodgoricaFlightsDiagnostic;
const getCachedAirportFlights = getCachedPodgoricaFlights;
const isAirportFlightsUpstreamErrorCode = isPodgoricaFlightsUpstreamErrorCode;
const refreshAirportFlights = refreshPodgoricaFlights;

type AirportFlightsCacheSnapshot = PodgoricaFlightsCacheSnapshot;
type AirportFlightsCacheResult = PodgoricaFlightsCacheResult;
type AirportFlightsDiagnosticEmitter = PodgoricaFlightsDiagnosticEmitter;
type AirportFlightsHttpClient = PodgoricaFlightsHttpClient;
type AirportFlightsRefreshResult = PodgoricaFlightsRefreshResult;

export {
  airportFlightsSources,
  assertAirportFlightsUrl,
  assertPodgoricaFlightsUrl,
  createAirportFlightsHttpClient,
  createAirportFlightsUrl,
  createPodgoricaFlightsHttpClient,
  createPodgoricaFlightsUrl,
  defaultPodgoricaFlightsCachePath,
  emitAirportFlightsDiagnostic,
  emitPodgoricaFlightsDiagnostic,
  getAirportFlightsSource,
  getCachedAirportFlights,
  getCachedPodgoricaFlights,
  getFlightsCachePath,
  isAirportFlightsUpstreamErrorCode,
  isFlightsSupportedCityId,
  isPodgoricaFlightsUpstreamErrorCode,
  montenegroAirportsFeedUrl,
  parseAirportFlights,
  parsePodgoricaFlights,
  parseTivatFlights,
  refreshAirportFlights,
  refreshPodgoricaFlights,
  PodgoricaFlightsFetchError,
  type AirportFlightsCacheResult,
  type AirportFlightsCacheSnapshot,
  type AirportFlightsDiagnosticEmitter,
  type AirportFlightsHttpClient,
  type AirportFlightsRefreshResult,
  type FlightCacheState,
  type FlightsSupportedCityId,
  type PodgoricaFlightsCacheSnapshot,
  type PodgoricaFlightsCacheResult,
  type PodgoricaFlightsDiagnosticEmitter,
  type PodgoricaFlightsHttpClient,
  type PodgoricaFlightsRequestFailureCategory,
  type PodgoricaFlightsRefreshResult,
};
