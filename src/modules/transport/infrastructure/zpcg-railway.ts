import { resolveRuntimeCachePath } from "../../../config/runtime-data.ts";
import {
  calculateCacheFreshness,
  readJsonCache,
  writeJsonCache,
} from "../../../shared/lib/cache.ts";
import {
  normalizeRailwayDeparture,
  sortAndDeduplicateRailwayDepartures,
  type RailwayDeparture,
} from "../domain/railway-departure.ts";

const zpcgTimetableUrl = "https://zpcg.me/red-voznje/ukupno";
const defaultCachePath = resolveZpcgRailwayCachePath();
const maximumResponseLength = 1_500_000;
const providerId = "zpcg-railway";

type RailwayCacheState = "fresh" | "stale" | "unavailable";
type ZpcgRefreshPhase = "cache" | "parser" | "request" | "response";

interface ZpcgRailwayCacheSnapshot {
  departures: RailwayDeparture[];
  fetchedAt: string;
  freshnessStatus: RailwayCacheState;
  lastRefreshError?: string;
  lastSuccessfulRefreshAt: string;
  parserWarnings: string[];
  schemaVersion: 1;
  sourceUrl: string;
  timetableDate: string;
}

interface ZpcgDocumentSummary {
  headings: string[];
  title: string;
}

interface ZpcgParseResult {
  acceptedDepartures: number;
  contentRecognized: boolean;
  departures: RailwayDeparture[];
  document: ZpcgDocumentSummary;
  explicitlyEmpty: boolean;
  rawRowsDetected: number;
  rejectedDepartures: number;
  sectionFound: boolean;
  timetableDate?: string;
  timetableDateSource: "document" | "requested-day" | "unavailable";
  warnings: string[];
}

interface ZpcgHttpResponse {
  contentType: string | null;
  finalUrl: string;
  html: string;
  requestedUrl: string;
  status: number;
}

interface ZpcgHttpClient {
  get(url: string): Promise<ZpcgHttpResponse>;
}

interface ZpcgRefreshDiagnostic {
  acceptedDepartures?: number;
  cachePath: string;
  cacheWriteResult?: "not-attempted" | "retained" | "written";
  contentType?: string | null;
  error?: { message: string; name: string };
  finalUrl?: string;
  htmlLength?: number;
  phase: ZpcgRefreshPhase;
  podgoricaSectionFound?: boolean;
  previousSnapshotRetained?: boolean;
  provider: typeof providerId;
  rawRowsDetected?: number;
  rejectedDepartures?: number;
  requestedUrl: string;
  status?: number;
  timetableDate?: string;
  timestamp: string;
  title?: string;
  headings?: string[];
}

interface ZpcgRefreshResult {
  acceptedDepartures: number;
  errorCode?: string;
  phase: ZpcgRefreshPhase;
  retainedPreviousSnapshot: boolean;
  snapshot: ZpcgRailwayCacheSnapshot | null;
  success: boolean;
  warnings: string[];
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

type ZpcgDiagnosticEmitter = (diagnostic: ZpcgRefreshDiagnostic) => void;

class ZpcgFetchError extends Error {
  readonly code:
    | "zpcg-host-rejected"
    | "zpcg-invalid-content-type"
    | "zpcg-request-failed"
    | "zpcg-request-timeout"
    | "zpcg-response-too-large";
  readonly details?: {
    contentType?: string | null;
    finalUrl?: string;
    requestedUrl?: string;
    status?: number;
  };

  constructor(
    code: ZpcgFetchError["code"],
    message: string,
    details?: ZpcgFetchError["details"],
  ) {
    super(message);
    this.name = "ZpcgFetchError";
    this.code = code;
    this.details = details;
  }
}

function createZpcgHttpClient({
  fetchImplementation = fetch,
  retries = 1,
  timeoutMs = 10_000,
}: {
  fetchImplementation?: FetchImplementation;
  retries?: number;
  timeoutMs?: number;
} = {}): ZpcgHttpClient {
  return {
    async get(requestedUrl) {
      assertZpcgUrl(requestedUrl);

      let latestError: ZpcgFetchError | undefined;

      for (let attempt = 0; attempt <= retries; attempt += 1) {
        try {
          const response = await fetchImplementation(requestedUrl, {
            headers: {
              "User-Agent": "Gradom/0.1 (+https://gradom.me)",
            },
            signal: AbortSignal.timeout(timeoutMs),
          });
          const finalUrl = response.url || requestedUrl;
          assertZpcgUrl(finalUrl);

          if (!response.ok) {
            latestError = new ZpcgFetchError(
              "zpcg-request-failed",
              `ŽPCG returned HTTP ${response.status}.`,
              { finalUrl, requestedUrl, status: response.status },
            );

            if (response.status < 429) break;
            continue;
          }

          const contentType = response.headers?.get("content-type") ?? null;

          if (!contentType?.toLocaleLowerCase().includes("text/html")) {
            throw new ZpcgFetchError(
              "zpcg-invalid-content-type",
              "ŽPCG did not return an HTML timetable document.",
              { contentType, finalUrl, requestedUrl, status: response.status },
            );
          }

          const html = await response.text();

          if (!html.trim()) {
            throw new ZpcgFetchError(
              "zpcg-request-failed",
              "ŽPCG returned an empty timetable document.",
              { contentType, finalUrl, requestedUrl, status: response.status },
            );
          }

          if (html.length > maximumResponseLength) {
            throw new ZpcgFetchError(
              "zpcg-response-too-large",
              "ŽPCG response exceeded the allowed size.",
              { contentType, finalUrl, requestedUrl, status: response.status },
            );
          }

          return {
            contentType,
            finalUrl,
            html,
            requestedUrl,
            status: response.status,
          };
        } catch (error) {
          if (error instanceof ZpcgFetchError) {
            latestError = error;

            if (
              error.code === "zpcg-host-rejected" ||
              error.code === "zpcg-invalid-content-type" ||
              error.code === "zpcg-response-too-large"
            ) {
              break;
            }
          } else {
            const timedOut = error instanceof Error && error.name === "AbortError";
            latestError = new ZpcgFetchError(
              timedOut ? "zpcg-request-timeout" : "zpcg-request-failed",
              timedOut ? "ŽPCG request timed out." : "ŽPCG request failed.",
            );
          }
        }
      }

      throw latestError ?? new ZpcgFetchError("zpcg-request-failed", "ŽPCG request failed.");
    },
  };
}

function assertZpcgUrl(value: string): void {
  try {
    const url = new URL(value);

    if (url.protocol !== "https:" || url.hostname !== "zpcg.me") {
      throw new Error("Rejected ŽPCG URL.");
    }
  } catch {
    throw new ZpcgFetchError(
      "zpcg-host-rejected",
      "ŽPCG URL host is not allowed.",
    );
  }
}

function parseZpcgPodgoricaDepartures(
  html: string,
  requestedDate: string,
): ZpcgParseResult {
  const document = summarizeDocument(html);
  const sectionHtml = extractPodgoricaSectionHtml(html);
  const timetableDateFromDocument = extractTimetableDate(html);
  const timetableDate = timetableDateFromDocument ?? requestedDate;
  const timetableDateSource = timetableDateFromDocument
    ? "document"
    : requestedDate
      ? "requested-day"
      : "unavailable";

  if (!sectionHtml) {
    return {
      acceptedDepartures: 0,
      contentRecognized: false,
      departures: [],
      document,
      explicitlyEmpty: false,
      rawRowsDetected: 0,
      rejectedDepartures: 0,
      sectionFound: false,
      timetableDate: timetableDateFromDocument,
      timetableDateSource: timetableDateFromDocument ? "document" : "unavailable",
      warnings: ["ŽPCG Podgorica departures section was unavailable."],
    };
  }

  const sectionText = normalizeHtmlText(sectionHtml);
  const rawRows = splitDepartureRows(sectionText);
  const detailsUrls = extractDetailsUrls(sectionHtml);
  const departures = rawRows.flatMap((rawRow, index) =>
    parseDepartureRow(rawRow, timetableDate, detailsUrls[index]),
  );
  const deduplicatedDepartures = sortAndDeduplicateRailwayDepartures(departures);
  const explicitlyEmpty = /nema\s+(?:polazaka|dostupnih\s+polazaka)/i.test(sectionText);
  const timetableDateConfirmed = Boolean(timetableDateFromDocument);
  const acceptedDepartures = deduplicatedDepartures.length;

  return {
    acceptedDepartures,
    contentRecognized:
      acceptedDepartures > 0 || (explicitlyEmpty && timetableDateConfirmed),
    departures: deduplicatedDepartures,
    document,
    explicitlyEmpty,
    rawRowsDetected: rawRows.length,
    rejectedDepartures: Math.max(rawRows.length - departures.length, 0),
    sectionFound: true,
    timetableDate: timetableDateConfirmed ? timetableDate : undefined,
    timetableDateSource,
    warnings:
      acceptedDepartures > 0 || (explicitlyEmpty && timetableDateConfirmed)
        ? []
        : ["ŽPCG Podgorica departures section contained no recognizable records."],
  };
}

async function refreshZpcgRailway({
  cachePath = defaultCachePath,
  emitDiagnostic = emitZpcgDiagnostic,
  httpClient,
  now = () => new Date(),
}: {
  cachePath?: string;
  emitDiagnostic?: ZpcgDiagnosticEmitter;
  httpClient: ZpcgHttpClient;
  now?: () => Date;
}): Promise<ZpcgRefreshResult> {
  const requestedDate = localDate(now());
  let previous: ZpcgRailwayCacheSnapshot | null;

  try {
    previous = await readJsonCache<ZpcgRailwayCacheSnapshot>(cachePath);
  } catch (error) {
    return retain(null, "cache", "zpcg-cache-read-failed", [], emitDiagnostic, {
      cachePath,
      error,
      requestedUrl: zpcgTimetableUrl,
    });
  }

  emitDiagnostic({
    cachePath,
    cacheWriteResult: "not-attempted",
    phase: "request",
    provider: providerId,
    requestedUrl: zpcgTimetableUrl,
    timestamp: now().toISOString(),
  });

  try {
    const response = await httpClient.get(zpcgTimetableUrl);
    emitDiagnostic({
      cachePath,
      cacheWriteResult: "not-attempted",
      contentType: response.contentType,
      finalUrl: response.finalUrl,
      htmlLength: response.html.length,
      phase: "response",
      provider: providerId,
      requestedUrl: response.requestedUrl,
      status: response.status,
      timestamp: now().toISOString(),
    });

    const parsed = parseZpcgPodgoricaDepartures(response.html, requestedDate);
    emitDiagnostic({
      acceptedDepartures: parsed.acceptedDepartures,
      cachePath,
      cacheWriteResult: "not-attempted",
      contentType: response.contentType,
      finalUrl: response.finalUrl,
      headings: parsed.sectionFound ? undefined : parsed.document.headings,
      htmlLength: response.html.length,
      phase: "parser",
      podgoricaSectionFound: parsed.sectionFound,
      provider: providerId,
      rawRowsDetected: parsed.rawRowsDetected,
      rejectedDepartures: parsed.rejectedDepartures,
      requestedUrl: response.requestedUrl,
      status: response.status,
      timetableDate: parsed.timetableDate,
      timestamp: now().toISOString(),
      title: parsed.sectionFound ? undefined : parsed.document.title,
    });

    if (!parsed.sectionFound) {
      return retain(previous, "parser", "zpcg-section-unavailable", parsed.warnings, emitDiagnostic, {
        cachePath,
        parsed,
        response,
      });
    }

    if (!parsed.contentRecognized) {
      return retain(previous, "parser", "zpcg-records-unrecognized", parsed.warnings, emitDiagnostic, {
        cachePath,
        response,
        parsed,
      });
    }

    const timestamp = now().toISOString();
    const snapshot: ZpcgRailwayCacheSnapshot = {
      departures: parsed.departures,
      fetchedAt: timestamp,
      freshnessStatus: "fresh",
      lastSuccessfulRefreshAt: timestamp,
      parserWarnings: parsed.warnings,
      schemaVersion: 1,
      sourceUrl: zpcgTimetableUrl,
      timetableDate: parsed.timetableDate ?? requestedDate,
    };

    try {
      await writeJsonCache(snapshot, cachePath);
    } catch (error) {
      return retain(previous, "cache", "zpcg-cache-write-failed", parsed.warnings, emitDiagnostic, {
        cachePath,
        error,
        parsed,
        response,
      });
    }

    emitDiagnostic({
      acceptedDepartures: parsed.acceptedDepartures,
      cachePath,
      cacheWriteResult: "written",
      contentType: response.contentType,
      finalUrl: response.finalUrl,
      htmlLength: response.html.length,
      phase: "cache",
      podgoricaSectionFound: true,
      previousSnapshotRetained: false,
      provider: providerId,
      rawRowsDetected: parsed.rawRowsDetected,
      rejectedDepartures: parsed.rejectedDepartures,
      requestedUrl: response.requestedUrl,
      status: response.status,
      timetableDate: snapshot.timetableDate,
      timestamp,
    });

    return {
      acceptedDepartures: parsed.acceptedDepartures,
      phase: "cache",
      retainedPreviousSnapshot: false,
      snapshot,
      success: true,
      warnings: parsed.warnings,
    };
  } catch (error) {
    const fetchError = error instanceof ZpcgFetchError ? error : undefined;
    return retain(
      previous,
      fetchError?.details?.status ? "response" : "request",
      getErrorCode(error),
      [],
      emitDiagnostic,
      {
        cachePath,
        contentType: fetchError?.details?.contentType,
        error,
        finalUrl: fetchError?.details?.finalUrl,
        requestedUrl: fetchError?.details?.requestedUrl ?? zpcgTimetableUrl,
        status: fetchError?.details?.status,
      },
    );
  }
}

async function getCachedZpcgRailway(cachePath = defaultCachePath) {
  const snapshot = await readJsonCache<ZpcgRailwayCacheSnapshot>(cachePath);

  if (!snapshot) return { departures: [], state: "unavailable" as const };

  const freshness = calculateCacheFreshness(
    new Date(snapshot.fetchedAt),
    new Date(),
    780,
  );

  return { departures: snapshot.departures, state: freshness };
}

function extractPodgoricaSectionHtml(html: string): string | undefined {
  const headings = [...html.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)];
  const podgoricaHeadingIndex = headings.findIndex((heading) =>
    isPodgoricaDepartureHeading(normalizeHtmlText(heading[2])),
  );

  if (podgoricaHeadingIndex < 0) return undefined;

  const start = (headings[podgoricaHeadingIndex].index ?? 0) + headings[podgoricaHeadingIndex][0].length;
  const nextStationHeading = headings
    .slice(podgoricaHeadingIndex + 1)
    .find((heading) => {
      const text = normalizeHtmlText(heading[2]);
      return /polasci\s+iz\s+stanice/i.test(text) && !isPodgoricaDepartureHeading(text);
    });
  const end = nextStationHeading?.index ?? html.length;

  return html.slice(start, end);
}

function isPodgoricaDepartureHeading(value: string): boolean {
  return /^polasci\s+iz\s+stanice\s+podgorica$/i.test(value.trim());
}

function normalizeHtmlText(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<\/(?:article|div|li|p|section|table|tr|h[1-6])>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'");
}

function extractTimetableDate(html: string): string | undefined {
  const dateInput = [...html.matchAll(/<input\b[^>]*>/gi)].find((input) =>
    /(?:name|id)=["'](?:date|datum)["']/i.test(input[0]),
  )?.[0];
  const date = dateInput?.match(/value=["'](\d{4}-\d{2}-\d{2})["']/i)?.[1];

  return date ?? html.match(/(?:datum|date)\D{0,40}(\d{4}-\d{2}-\d{2})/i)?.[1];
}

function splitDepartureRows(sectionText: string): string[] {
  return sectionText
    .split(/(?=\bPolazak\s+\d{1,2}:\d{2}\b)/gi)
    .filter((row) => /\bPolazak\s+\d{1,2}:\d{2}\b/i.test(row));
}

function parseDepartureRow(
  rawRow: string,
  departureDate: string,
  detailsUrl?: string,
): RailwayDeparture[] {
  const departureTime = rawRow.match(/\bPolazak\s+(\d{1,2}:\d{2})\b/i)?.[1];
  const arrivalTime = rawRow.match(/\bDolazak\s+(\d{1,2}:\d{2})\b/i)?.[1];
  const destination = rawRow.match(/\bPodgorica\s+(.+?)\s+Dolazak\b/i)?.[1];
  const trainNumber = rawRow.match(/\bVoz\s*:?\s*([^\s]+)/i)?.[1];
  const duration = rawRow.match(/\bVoz\s*:?\s*[^\s]+\s+(\d+h(?:\s+\d+m)?|\d+m)\b/i)?.[1];
  const firstClassPrice = rawRow.match(/1\.?\s*razred\s*([\d.,]+\s*€?)/i)?.[1];
  const secondClassPrice = rawRow.match(/2\.?\s*razred\s*([\d.,]+\s*€?)/i)?.[1];

  if (!departureTime || !arrivalTime || !destination) return [];

  const departure = normalizeRailwayDeparture({
    arrivalTime: arrivalTime.padStart(5, "0"),
    departureDate,
    departureStation: "Podgorica",
    departureTime: departureTime.padStart(5, "0"),
    destination,
    ...(detailsUrl ? { detailsUrl } : {}),
    ...(duration ? { duration } : {}),
    ...(firstClassPrice ? { firstClassPrice: compactPrice(firstClassPrice) } : {}),
    ...(secondClassPrice ? { secondClassPrice: compactPrice(secondClassPrice) } : {}),
    ...(trainNumber ? { trainNumber } : {}),
  });

  return departure ? [departure] : [];
}

function compactPrice(value: string): string {
  return value.replace(/\s+/g, "").replace(/€$/, "€");
}

function extractDetailsUrls(sectionHtml: string): (string | undefined)[] {
  return [
    ...sectionHtml.matchAll(/<a\b(?=[^>]*\bhref=["']([^"']+)["'])[^>]*>([\s\S]*?)<\/a>/gi),
  ]
    .filter((link) => /detalji|details/i.test(normalizeHtmlText(link[2])))
    .map((link) => resolveZpcgUrl(link[1]));
}

function resolveZpcgUrl(value: string): string | undefined {
  try {
    const url = new URL(value, zpcgTimetableUrl);
    return url.protocol === "https:" && url.hostname === "zpcg.me"
      ? url.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

function summarizeDocument(html: string): ZpcgDocumentSummary {
  const title = normalizeHtmlText(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
  const headings = [
    ...html.matchAll(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/gi),
  ]
    .map((heading) => normalizeHtmlText(heading[1]))
    .filter(Boolean)
    .slice(0, 8);

  return { headings, title };
}

function retain(
  previous: ZpcgRailwayCacheSnapshot | null,
  phase: ZpcgRefreshPhase,
  errorCode: string,
  warnings: string[],
  emitDiagnostic: ZpcgDiagnosticEmitter,
  context: {
    cachePath: string;
    contentType?: string | null;
    error?: unknown;
    finalUrl?: string;
    parsed?: ZpcgParseResult;
    requestedUrl?: string;
    response?: ZpcgHttpResponse;
    status?: number;
  },
): ZpcgRefreshResult {
  emitDiagnostic({
    acceptedDepartures: context.parsed?.acceptedDepartures,
    cachePath: context.cachePath,
    cacheWriteResult: previous ? "retained" : "not-attempted",
    contentType: context.response?.contentType ?? context.contentType,
    error: toErrorDiagnostic(context.error, errorCode),
    finalUrl: context.response?.finalUrl ?? context.finalUrl,
    headings: context.parsed?.sectionFound ? undefined : context.parsed?.document.headings,
    htmlLength: context.response?.html.length,
    phase,
    podgoricaSectionFound: context.parsed?.sectionFound,
    previousSnapshotRetained: Boolean(previous),
    provider: providerId,
    rawRowsDetected: context.parsed?.rawRowsDetected,
    rejectedDepartures: context.parsed?.rejectedDepartures,
    requestedUrl: context.response?.requestedUrl ?? context.requestedUrl ?? zpcgTimetableUrl,
    status: context.response?.status ?? context.status,
    timetableDate: context.parsed?.timetableDate,
    timestamp: new Date().toISOString(),
    title: context.parsed?.sectionFound ? undefined : context.parsed?.document.title,
  });

  return {
    acceptedDepartures: previous?.departures.length ?? 0,
    errorCode,
    phase,
    retainedPreviousSnapshot: Boolean(previous),
    snapshot: previous
      ? {
          ...previous,
          freshnessStatus: "stale",
          lastRefreshError: errorCode,
        }
      : null,
    success: false,
    warnings,
  };
}

function toErrorDiagnostic(
  error: unknown,
  fallbackMessage: string,
): { message: string; name: string } {
  return error instanceof Error
    ? { message: error.message, name: error.name }
    : { message: fallbackMessage, name: "ZpcgRailwayError" };
}

function getErrorCode(error: unknown): string {
  return error instanceof ZpcgFetchError ? error.code : "zpcg-refresh-failed";
}

function emitZpcgDiagnostic(diagnostic: ZpcgRefreshDiagnostic): void {
  console.info(JSON.stringify(diagnostic));
}

function localDate(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Europe/Podgorica",
    year: "numeric",
  }).formatToParts(now);
  const value = Object.fromEntries(
    parts.map(({ type, value: part }) => [type, part]),
  );

  return `${value.year}-${value.month}-${value.day}`;
}

function resolveZpcgRailwayCachePath(): string {
  if (process.env.ZPCG_RAILWAY_CACHE_PATH) {
    return process.env.ZPCG_RAILWAY_CACHE_PATH;
  }

  const eventCacheDirectory = process.env.EVENT_CACHE_DIR?.replace(/\/+$/, "");

  return eventCacheDirectory
    ? `${eventCacheDirectory}/zpcg-railway-departures.json`
    : resolveRuntimeCachePath("zpcg-railway-departures.json");
}

export {
  assertZpcgUrl,
  createZpcgHttpClient,
  defaultCachePath as defaultZpcgRailwayCachePath,
  getCachedZpcgRailway,
  parseZpcgPodgoricaDepartures,
  refreshZpcgRailway,
  zpcgTimetableUrl,
  ZpcgFetchError,
  type ZpcgHttpClient,
  type ZpcgRefreshDiagnostic,
  type ZpcgRefreshResult,
  type ZpcgRailwayCacheSnapshot,
};
