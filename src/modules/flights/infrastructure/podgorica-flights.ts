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

const podgoricaFlightsUrl = "https://montenegroairports.com/aerodrom-podgorica/destinacije/";
const defaultPodgoricaFlightsCachePath = env.PODGORICA_FLIGHTS_CACHE_PATH;
const maximumResponseLength = 2_000_000;

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
  html: string;
  requestedUrl: string;
  status: number;
}

interface PodgoricaFlightsHttpClient {
  get(url: string): Promise<PodgoricaFlightsHttpResponse>;
}

interface PodgoricaFlightsParseResult {
  flights: Flight[];
  recognized: boolean;
  rejected: number;
  tables: number;
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
            headers: { "User-Agent": "Gradom/0.1 (+https://gradom.me)" },
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
          if (!contentType?.toLocaleLowerCase().includes("text/html")) {
            throw new PodgoricaFlightsFetchError(
              "podgorica-flights-invalid-content-type",
              "Aerodrom Podgorica did not return an HTML flight schedule.",
            );
          }

          const html = await response.text();
          if (!html.trim()) {
            throw new PodgoricaFlightsFetchError(
              "podgorica-flights-request-failed",
              "Aerodrom Podgorica returned an empty flight schedule.",
            );
          }
          if (html.length > maximumResponseLength) {
            throw new PodgoricaFlightsFetchError(
              "podgorica-flights-response-too-large",
              "Aerodrom Podgorica response exceeded the allowed size.",
            );
          }

          return { contentType, finalUrl, html, requestedUrl, status: response.status };
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
          "Flight schedule request failed.",
        )
      );
    },
  };
}

function parsePodgoricaFlights(html: string, scheduledDate: string): PodgoricaFlightsParseResult {
  const cleanedHtml = html.replace(
    /<(?:script|style|noscript|svg)\b[^>]*>[\s\S]*?<\/(?:script|style|noscript|svg)>/gi,
    "",
  );
  const tables = [...cleanedHtml.matchAll(/<table\b([^>]*)>([\s\S]*?)<\/table>/gi)];
  const flights: Flight[] = [];
  let rejected = 0;
  let recognized = false;

  for (const table of tables) {
    const context = cleanedHtml.slice(Math.max(0, table.index! - 1_200), table.index);
    const direction = getDirection(`${table[1]} ${context}`);
    const rows = [...table[2].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
    const headerIndex = rows.findIndex((row) => /<th\b/i.test(row[1]));
    if (!direction || headerIndex < 0) continue;

    const headers = getCells(rows[headerIndex][1]).map(normalizeHeading);
    const indexes = getColumnIndexes(headers);
    if (indexes.time === undefined || indexes.location === undefined) continue;
    recognized = true;

    for (const row of rows.slice(headerIndex + 1)) {
      const cells = getCells(row[1]);
      if (cells.length <= Math.max(indexes.time, indexes.location)) continue;
      const flight = normalizeFlight({
        ...(indexes.airline !== undefined ? { airline: cells[indexes.airline] ?? "" } : {}),
        direction,
        ...(indexes.flightNumber !== undefined
          ? { flightNumber: cells[indexes.flightNumber] ?? "" }
          : {}),
        location: cells[indexes.location] ?? "",
        scheduledDate,
        scheduledTime: normalizeTime(cells[indexes.time] ?? ""),
        ...(indexes.status !== undefined ? { status: cells[indexes.status] ?? "" } : {}),
      });
      if (flight) flights.push(flight);
      else rejected += 1;
    }
  }

  return {
    flights: sortAndDeduplicateFlights(flights),
    recognized,
    rejected,
    tables: tables.length,
    warnings: recognized ? [] : ["Aerodrom Podgorica flight tables were unavailable."],
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
  const dates = [getLocalDate(now()), getLocalDate(addDays(now(), 1))];

  try {
    const parsed = await Promise.all(
      dates.map(async (date) => {
        const response = await httpClient.get(createPodgoricaFlightsUrl(date));
        return parsePodgoricaFlights(response.html, date);
      }),
    );
    if (!parsed.every((result) => result.recognized)) {
      return retainPrevious(
        previous,
        "podgorica-flights-parser-failed",
        parsed.flatMap((result) => result.warnings),
      );
    }

    const timestamp = now().toISOString();
    const snapshot: PodgoricaFlightsCacheSnapshot = {
      fetchedAt: timestamp,
      flights: sortAndDeduplicateFlights(parsed.flatMap((result) => result.flights)),
      lastSuccessfulRefreshAt: timestamp,
      parserWarnings: parsed.flatMap((result) => result.warnings),
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

function createPodgoricaFlightsUrl(date: string) {
  const url = new URL(podgoricaFlightsUrl);
  url.searchParams.set("datum1", date);
  url.searchParams.set("lang", "me");
  return url.toString();
}

function assertPodgoricaFlightsUrl(value: string) {
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      !["montenegroairports.com", "www.montenegroairports.com"].includes(url.hostname)
    ) {
      throw new Error("unapproved host");
    }
  } catch {
    throw new PodgoricaFlightsFetchError(
      "podgorica-flights-host-rejected",
      "Podgorica Airport URL host is not allowed.",
    );
  }
}

function getDirection(value: string): FlightDirection | undefined {
  const normalized = normalizeHeading(value);
  if (/\b(dolaz|arrival)/.test(normalized)) return "arrival";
  if (/\b(odlaz|departure)/.test(normalized)) return "departure";
  return undefined;
}

function getCells(rowHtml: string) {
  return [...rowHtml.matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((cell) =>
    htmlText(cell[1]),
  );
}

function getColumnIndexes(headers: readonly string[]) {
  return {
    airline: findHeaderIndex(headers, /avio.*kompan|kompan|airline|company|prevoznik/),
    flightNumber: findHeaderIndex(headers, /broj leta|flight(?: number)?|let\b/),
    location: findHeaderIndex(headers, /destinacij|destination|odakle|from/),
    status: findHeaderIndex(headers, /status/),
    time: findHeaderIndex(headers, /vrijeme|time|planirano|scheduled/),
  } as Record<"airline" | "flightNumber" | "location" | "status" | "time", number | undefined>;
}

function findHeaderIndex(headers: readonly string[], pattern: RegExp) {
  const index = headers.findIndex((header) => pattern.test(header));
  return index >= 0 ? index : undefined;
}

function normalizeHeading(value: string) {
  return value
    .toLocaleLowerCase("sr-Latn-ME")
    .replace(/č/g, "c")
    .replace(/š/g, "s")
    .replace(/ž/g, "z")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTime(value: string) {
  const time = value.match(/\b(\d{1,2}):(\d{2})\b/)?.slice(1);
  return time ? `${time[0].padStart(2, "0")}:${time[1]}` : "";
}

function htmlText(value: string) {
  return value
    .replace(/<br\s*\/?\s*>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function getLocalDate(value: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Europe/Podgorica",
    year: "numeric",
  }).formatToParts(value);
  const values = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]));
  return `${values.year}-${values.month}-${values.day}`;
}

function addDays(value: Date, days: number) {
  return new Date(value.getTime() + days * 24 * 60 * 60 * 1_000);
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
