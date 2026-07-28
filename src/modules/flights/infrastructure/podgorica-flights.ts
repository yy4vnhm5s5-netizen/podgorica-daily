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

const montenegroAirportsBaseUrl = "https://montenegroairports.com/aerodromixs/cache-flights.php";

// Airports of Montenegro serves every airport's flight feed from this one endpoint, selected by
// the `airport` query parameter (Podgorica is "pg"). Tivat Airport is part of the same official
// system (montenegroairports.com/aerodrom-tivat/), but its selector code does not appear anywhere
// in this repository and has not been verified against the live endpoint — it must not be
// guessed. Add a `tivat: "<verified-code>"` entry here once confirmed, and only then add
// "flights" to Tivat's capabilities in src/shared/config/cities.ts.
const montenegroAirportsCodes = {
  podgorica: "pg",
} as const;

type FlightsSupportedCityId = keyof typeof montenegroAirportsCodes;

const podgoricaFlightsUrl = buildMontenegroAirportsUrl("podgorica");
const defaultPodgoricaFlightsCachePath = env.PODGORICA_FLIGHTS_CACHE_PATH;
const maximumResponseLength = 2_000_000;
const maximumDiagnosticBodyPreviewLength = 200;
const retryDelayMs = 250;

function buildMontenegroAirportsUrl(cityId: FlightsSupportedCityId) {
  return `${montenegroAirportsBaseUrl}?airport=${montenegroAirportsCodes[cityId]}`;
}

function isFlightsSupportedCityId(cityId: string): cityId is FlightsSupportedCityId {
  return Object.hasOwn(montenegroAirportsCodes, cityId);
}

// Mirrors the CEDIS (getCedisCachePath) and MonteGigs (getGoingOutCachePath) derived-sibling-path
// convention: Podgorica keeps the existing configured cache path for backward compatibility;
// every other supported airport gets a sibling file derived from the same directory, so no new
// per-city environment variable is needed.
function getFlightsCachePath(cityId: FlightsSupportedCityId) {
  return cityId === "podgorica"
    ? defaultPodgoricaFlightsCachePath
    : join(dirname(defaultPodgoricaFlightsCachePath), `podgorica-flights-${cityId}.json`);
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
    | "podgorica-flights-host-rejected"
    | "podgorica-flights-invalid-content-type"
    | "podgorica-flights-request-failed"
    | "podgorica-flights-response-too-large"
    | "podgorica-flights-timeout";
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
      | "podgorica-flights-host-rejected"
      | "podgorica-flights-invalid-content-type"
      | "podgorica-flights-request-failed"
      | "podgorica-flights-response-too-large"
      | "podgorica-flights-timeout",
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
  retries = 1,
  timeoutMs = 10_000,
}: {
  fetchImplementation?: FetchImplementation;
  retries?: number;
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
              "podgorica-flights-request-failed",
              `Aerodrom Podgorica returned HTTP ${response.status}.`,
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
            await waitForRetry();
            continue;
          }

          const contentType = response.headers?.get("content-type") ?? null;
          if (!isJsonLikeContentType(contentType)) {
            throw new PodgoricaFlightsFetchError(
              "podgorica-flights-invalid-content-type",
              "Aerodrom Podgorica did not return the public flight-feed format.",
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
              "podgorica-flights-request-failed",
              "Aerodrom Podgorica returned an empty flight feed.",
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
              "podgorica-flights-response-too-large",
              "Aerodrom Podgorica response exceeded the allowed size.",
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
              error.code === "podgorica-flights-host-rejected" ||
              error.code === "podgorica-flights-invalid-content-type" ||
              error.code === "podgorica-flights-response-too-large"
            ) {
              break;
            }
          } else {
            latestError = new PodgoricaFlightsFetchError(
              isTimeoutError(error)
                ? "podgorica-flights-timeout"
                : "podgorica-flights-request-failed",
              isTimeoutError(error)
                ? "Aerodrom Podgorica request timed out."
                : "Aerodrom Podgorica request failed.",
              {
                attemptCount: attempt + 1,
                elapsedMs: Date.now() - requestStartedAt,
                failureCategory: classifyRequestFailure(error),
                upstreamHostname,
              },
            );
          }
        }
      }

      throw (
        latestError ??
        new PodgoricaFlightsFetchError(
          "podgorica-flights-request-failed",
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
    const parsed = parsePodgoricaFlights(response.body);
    if (!parsed.recognized) {
      emitPodgoricaFlightsFailureDiagnostic({
        attemptCount: response.attemptCount ?? 1,
        diagnostic,
        diagnosticNow: now(),
        errorCode: "podgorica-flights-parser-failed",
        failureCategory: "response-format",
        finalHostname: getUrlHostname(response.finalUrl),
        httpStatus: response.status,
        previous,
        responseMetadata: getSuccessfulResponseDiagnosticMetadata(response),
        upstreamHostname: getUrlHostname(response.requestedUrl) ?? "unknown",
      });
      return retainPrevious(previous, "podgorica-flights-parser-failed", parsed.warnings);
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
      return retainPrevious(previous, "podgorica-flights-cache-write-failed", []);
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

function createPodgoricaFlightsUrl(cityId: FlightsSupportedCityId = "podgorica") {
  return buildMontenegroAirportsUrl(cityId);
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
      !Object.values(montenegroAirportsCodes).includes(
        airportCode as (typeof montenegroAirportsCodes)[FlightsSupportedCityId],
      )
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
    "podgorica-flights-request-failed",
    "Podgorica Airport request URL is not allowed.",
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
    event: "podgorica-flights-request-failed",
    failureCategory,
    failureType: getFailureType(failureCategory),
    finalState: "failed",
    ...(elapsedMs !== undefined ? { elapsedMs } : {}),
    ...(finalHostname ? { finalHostname } : {}),
    ...(httpStatus !== undefined ? { httpStatus } : {}),
    provider: "podgorica-airport",
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

function isRetryableHttpStatus(status: number) {
  return status === 429 || [500, 502, 503, 504].includes(status);
}

function waitForRetry() {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, retryDelayMs);
  });
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

export {
  assertPodgoricaFlightsUrl,
  createPodgoricaFlightsHttpClient,
  createPodgoricaFlightsUrl,
  defaultPodgoricaFlightsCachePath,
  emitPodgoricaFlightsDiagnostic,
  getCachedPodgoricaFlights,
  getFlightsCachePath,
  isFlightsSupportedCityId,
  montenegroAirportsCodes,
  parsePodgoricaFlights,
  podgoricaFlightsUrl,
  refreshPodgoricaFlights,
  PodgoricaFlightsFetchError,
  type FlightCacheState,
  type FlightsSupportedCityId,
  type PodgoricaFlightsCacheSnapshot,
  type PodgoricaFlightsCacheResult,
  type PodgoricaFlightsDiagnosticEmitter,
  type PodgoricaFlightsHttpClient,
  type PodgoricaFlightsRequestFailureCategory,
  type PodgoricaFlightsRefreshResult,
};
