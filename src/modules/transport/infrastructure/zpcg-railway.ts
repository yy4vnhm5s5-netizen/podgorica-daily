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
const defaultCachePath = resolveRuntimeCachePath("zpcg-railway-departures.json");
const maximumResponseBytes = 1_500_000;

type RailwayCacheState = "fresh" | "stale" | "unavailable";

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

interface ZpcgParseResult {
  contentRecognized: boolean;
  departures: RailwayDeparture[];
  sectionFound: boolean;
  timetableDate: string;
  warnings: string[];
}

interface ZpcgHttpClient {
  get(url: string): Promise<string>;
}

type FetchImplementation = (
  url: string,
  init: RequestInit,
) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

class ZpcgFetchError extends Error {
  readonly code:
    | "zpcg-host-rejected"
    | "zpcg-request-failed"
    | "zpcg-request-timeout"
    | "zpcg-response-too-large";

  constructor(code: ZpcgFetchError["code"], message: string) {
    super(message);
    this.name = "ZpcgFetchError";
    this.code = code;
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
    async get(url) {
      assertZpcgUrl(url);

      let latestError: ZpcgFetchError | undefined;

      for (let attempt = 0; attempt <= retries; attempt += 1) {
        try {
          const response = await fetchImplementation(url, {
            headers: {
              "User-Agent": "Gradom/0.1 (+https://gradom.me)",
            },
            signal: AbortSignal.timeout(timeoutMs),
          });

          if (!response.ok) {
            latestError = new ZpcgFetchError(
              "zpcg-request-failed",
              `ŽPCG returned HTTP ${response.status}.`,
            );

            if (response.status < 429) {
              break;
            }

            continue;
          }

          const html = await response.text();

          if (html.length > maximumResponseBytes) {
            throw new ZpcgFetchError(
              "zpcg-response-too-large",
              "ŽPCG response exceeded the allowed size.",
            );
          }

          return html;
        } catch (error) {
          if (error instanceof ZpcgFetchError) {
            latestError = error;

            if (error.code === "zpcg-response-too-large") {
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

      throw (
        latestError ??
        new ZpcgFetchError("zpcg-request-failed", "ŽPCG request failed.")
      );
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
  fallbackDate: string,
): ZpcgParseResult {
  const normalizedHtml = normalizeHtmlText(html);
  const heading = /Polasci iz stanice Podgorica/i.exec(normalizedHtml);

  if (!heading) {
    return {
      contentRecognized: false,
      departures: [],
      sectionFound: false,
      timetableDate: fallbackDate,
      warnings: ["ŽPCG Podgorica departures section was unavailable."],
    };
  }

  const section = (
    normalizedHtml
      .slice(heading.index + heading[0].length)
      .split(/Polasci iz stanice (?!Podgorica)/i)[0] ?? ""
  ).trim();
  const timetableDate = extractTimetableDate(html) ?? fallbackDate;
  const records = [...section.matchAll(departureRecordPattern)];
  const detailUrls = extractDetailsUrls(html);
  const departures = records.flatMap((match, index) => {
    const departure = normalizeRailwayDeparture({
      arrivalTime: match[5],
      departureDate: timetableDate,
      departureStation: "Podgorica",
      departureTime: match[1].padStart(5, "0"),
      destination: match[4].trim(),
      detailsUrl: detailUrls[index],
      duration: match[3],
      firstClassPrice: match[6],
      secondClassPrice: match[7],
      trainNumber: match[2],
    });

    return departure ? [departure] : [];
  });
  const explicitlyEmpty = /nema\s+(?:polazaka|dostupnih\s+polazaka)/i.test(section);

  const hasValidDepartures = departures.length > 0;

  return {
    contentRecognized: hasValidDepartures || explicitlyEmpty,
    departures: sortAndDeduplicateRailwayDepartures(departures),
    sectionFound: true,
    timetableDate,
    warnings:
      hasValidDepartures || explicitlyEmpty
        ? []
        : ["ŽPCG Podgorica departures section contained no recognizable records."],
  };
}

async function refreshZpcgRailway({
  cachePath = defaultCachePath,
  httpClient,
  now = () => new Date(),
}: {
  cachePath?: string;
  httpClient: ZpcgHttpClient;
  now?: () => Date;
}) {
  const previous = await readJsonCache<ZpcgRailwayCacheSnapshot>(cachePath);

  try {
    const timestamp = now().toISOString();
    const parsed = parseZpcgPodgoricaDepartures(
      await httpClient.get(zpcgTimetableUrl),
      localDate(now()),
    );

    if (!parsed.sectionFound) {
      return retain(previous, "zpcg-section-unavailable", parsed.warnings);
    }

    if (!parsed.contentRecognized) {
      return retain(previous, "zpcg-records-unrecognized", parsed.warnings);
    }

    const snapshot: ZpcgRailwayCacheSnapshot = {
      departures: parsed.departures,
      fetchedAt: timestamp,
      freshnessStatus: "fresh",
      lastSuccessfulRefreshAt: timestamp,
      parserWarnings: parsed.warnings,
      schemaVersion: 1,
      sourceUrl: zpcgTimetableUrl,
      timetableDate: parsed.timetableDate,
    };

    await writeJsonCache(snapshot, cachePath);

    return {
      retainedPreviousSnapshot: false,
      snapshot,
      success: true,
      warnings: parsed.warnings,
    };
  } catch (error) {
    return retain(
      previous,
      error instanceof ZpcgFetchError ? error.code : "zpcg-refresh-failed",
      [],
    );
  }
}

async function getCachedZpcgRailway(
  cachePath = defaultCachePath,
) {
  const snapshot = await readJsonCache<ZpcgRailwayCacheSnapshot>(cachePath);

  if (!snapshot) {
    return { departures: [], state: "unavailable" as const };
  }

  const freshness = calculateCacheFreshness(
    new Date(snapshot.fetchedAt),
    new Date(),
    780,
  );

  return { departures: snapshot.departures, state: freshness };
}

function normalizeHtmlText(html: string): string {
  return html
    .replace(/<\/(?:p|div|li|tr|article|section|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .replace(/ ?\n ?/g, "\n");
}

function extractTimetableDate(html: string): string | undefined {
  return html.match(
    /(?:name|id)=["'](?:date|datum)["'][^>]*value=["'](\d{4}-\d{2}-\d{2})/i,
  )?.[1];
}

function extractDetailsUrls(html: string): (string | undefined)[] {
  const headingIndex = html.search(/Polasci\s+iz\s+stanice\s+Podgorica/i);
  const afterHeading = headingIndex >= 0 ? html.slice(headingIndex) : "";
  const nextHeadingIndex = afterHeading.slice(1).search(/<h[1-6]\b/i);
  const sourceSection =
    nextHeadingIndex >= 0
      ? afterHeading.slice(0, nextHeadingIndex + 1)
      : afterHeading;

  return [
    ...sourceSection.matchAll(/href=["']([^"']*(?:detalji|details)[^"']*)["']/gi),
  ].map((match) => resolveZpcgUrl(match[1]));
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

function retain(
  previous: ZpcgRailwayCacheSnapshot | null,
  errorCode: string,
  warnings: string[],
) {
  return {
    errorCode,
    retainedPreviousSnapshot: Boolean(previous),
    snapshot: previous
      ? {
          ...previous,
          freshnessStatus: "stale" as const,
          lastRefreshError: errorCode,
        }
      : null,
    success: false,
    warnings,
  };
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

const departureRecordPattern =
  /Polazak\s+(\d{1,2}:\d{2})\s+Voz:\s*([^\s]+)\s+(?:(\d+h(?:\s+\d+m)?|\d+m)\s+)?Podgorica\s+(.+?)\s+Dolazak\s+(\d{1,2}:\d{2})\s+1\.\s*razred\s+([\d.,]+€)\s+2\.\s*razred\s+([\d.,]+€)/gi;

export {
  assertZpcgUrl,
  createZpcgHttpClient,
  defaultCachePath as defaultZpcgRailwayCachePath,
  getCachedZpcgRailway,
  parseZpcgPodgoricaDepartures,
  refreshZpcgRailway,
  zpcgTimetableUrl,
  ZpcgFetchError,
  type ZpcgRailwayCacheSnapshot,
};
