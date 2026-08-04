import { z } from "zod";

import { env } from "../../../config/env.ts";
import { resolveRuntimeCachePath } from "../../../config/runtime-data.ts";
import {
  calculateCacheFreshness,
  readJsonCache,
  writeJsonCache,
} from "../../../shared/lib/cache.ts";
import type { CityContext, CityId } from "../../../shared/types/city.ts";

import {
  normalizeGoingOutEvent,
  selectUpcomingGoingOutEvents,
  sortAndDeduplicateGoingOutEvents,
  type GoingOutEvent,
} from "../domain/going-out-event.ts";

const maximumResponseLength = 1_500_000;

const monteGigsCitySources = {
  bar: {
    cityId: "bar",
    listingUrl: "https://staging.montegigs.me/me/events/bar",
  },
  budva: {
    cityId: "budva",
    listingUrl: "https://staging.montegigs.me/me/events/budva",
  },
  kotor: {
    cityId: "kotor",
    listingUrl: "https://staging.montegigs.me/me/events/kotor",
  },
  podgorica: {
    cityId: "podgorica",
    listingUrl: "https://staging.montegigs.me/me/events/podgorica",
  },
  // URL derived from the same unbroken convention as the two entries above (the city's own
  // registry id used verbatim as the /me/events/<cityId> path segment, no abbreviation or
  // transformation). Not independently fetched/verified against the live site — spot-check the
  // first real collector run before relying on it.
  tivat: {
    cityId: "tivat",
    listingUrl: "https://staging.montegigs.me/me/events/tivat",
  },
} as const;

type MonteGigsSupportedCityId = keyof typeof monteGigsCitySources;

type GoingOutCacheState = "fresh" | "stale" | "unavailable";

interface GoingOutCacheSnapshot {
  cityId: MonteGigsSupportedCityId;
  events: GoingOutEvent[];
  fetchedAt: string;
  lastRefreshError?: string;
  lastSuccessfulRefreshAt: string;
  parserWarnings: string[];
  schemaVersion: 1;
  sourceUrl: string;
}

interface GoingOutHttpResponse {
  body: string;
  contentType: string | null;
  finalUrl: string;
  requestedUrl: string;
  status: number;
}

interface GoingOutHttpClient {
  get(url: string): Promise<GoingOutHttpResponse>;
}

interface GoingOutParseResult {
  events: GoingOutEvent[];
  recognized: boolean;
  rejected: number;
  records: number;
  warnings: string[];
}

interface MonteGigsEventLink {
  cityId: string;
  content: string;
  href: string;
  index: number;
  raw: string;
}

interface GoingOutRefreshResult {
  acceptedEvents: number;
  errorCode?: string;
  retainedPreviousSnapshot: boolean;
  snapshot: GoingOutCacheSnapshot | null;
  success: boolean;
  warnings: string[];
}

interface GoingOutCacheResult {
  events: GoingOutEvent[];
  lastSuccessfulRefreshAt?: string;
  state: GoingOutCacheState;
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

class MonteGigsFetchError extends Error {
  readonly code:
    | "montegigs-city-source-rejected"
    | "montegigs-city-unsupported"
    | "montegigs-host-rejected"
    | "montegigs-invalid-content-type"
    | "montegigs-request-failed"
    | "montegigs-response-too-large"
    | "montegigs-timeout";

  constructor(code: MonteGigsFetchError["code"], message: string) {
    super(message);
    this.name = "MonteGigsFetchError";
    this.code = code;
  }
}

function createMonteGigsHttpClient({
  fetchImplementation = fetch,
  retries = 1,
  timeoutMs = 10_000,
}: {
  fetchImplementation?: FetchImplementation;
  retries?: number;
  timeoutMs?: number;
} = {}): GoingOutHttpClient {
  return {
    async get(requestedUrl) {
      assertMonteGigsUrl(requestedUrl);
      let latestError: MonteGigsFetchError | undefined;

      for (let attempt = 0; attempt <= retries; attempt += 1) {
        try {
          const response = await fetchImplementation(requestedUrl, {
            headers: {
              Accept: "text/html,application/xhtml+xml",
              "User-Agent": "Gradom/0.1 (+https://gradom.me)",
            },
            signal: AbortSignal.timeout(timeoutMs),
          });
          const finalUrl = response.url || requestedUrl;
          assertMonteGigsUrl(finalUrl);

          if (!response.ok) {
            latestError = new MonteGigsFetchError(
              "montegigs-request-failed",
              `MonteGigs returned HTTP ${response.status}.`,
            );
            if (response.status < 429) break;
            continue;
          }

          const contentType = response.headers?.get("content-type") ?? null;
          if (!contentType?.toLocaleLowerCase().includes("text/html")) {
            throw new MonteGigsFetchError(
              "montegigs-invalid-content-type",
              "MonteGigs did not return an HTML listing document.",
            );
          }

          const body = await response.text();
          if (!body.trim()) {
            throw new MonteGigsFetchError(
              "montegigs-request-failed",
              "MonteGigs returned an empty listing.",
            );
          }
          if (body.length > maximumResponseLength) {
            throw new MonteGigsFetchError(
              "montegigs-response-too-large",
              "MonteGigs response exceeded the allowed size.",
            );
          }

          return { body, contentType, finalUrl, requestedUrl, status: response.status };
        } catch (error) {
          if (error instanceof MonteGigsFetchError) {
            latestError = error;
            if (
              error.code === "montegigs-host-rejected" ||
              error.code === "montegigs-invalid-content-type" ||
              error.code === "montegigs-response-too-large"
            ) {
              break;
            }
          } else {
            latestError = new MonteGigsFetchError(
              error instanceof DOMException && error.name === "TimeoutError"
                ? "montegigs-timeout"
                : "montegigs-request-failed",
              error instanceof Error ? error.message : "MonteGigs request failed.",
            );
          }
        }
      }

      throw (
        latestError ??
        new MonteGigsFetchError("montegigs-request-failed", "MonteGigs request failed.")
      );
    },
  };
}

// MonteGigs renders each card as "date • venue" and never prints a clock time, but the same HTML
// response embeds the React Query payload the page was hydrated from, and that carries the source's
// own `time` field. This reads ONLY that field, keyed by the event's numeric MonteGigs id, and
// leaves every other payload value (venue address, cost, genre, event_type, status, artists)
// deliberately unread — the rendered markup remains the source of truth for everything else.
//
// Best-effort by construction: an absent, renamed or unparseable payload yields an empty map and
// collection proceeds exactly as before, simply without start times.
function extractMonteGigsEventTimes(html: string): ReadonlyMap<string, string> {
  const times = new Map<string, string>();
  // The payload is embedded with escaped quotes inside a script tag, so unescape before matching.
  const payload = html.replace(/\\"/g, '"');

  for (const match of payload.matchAll(
    /\{"time":(null|"[^"]*")[\s\S]{0,4000}?"id":(\d+),"date":"\d{4}-\d{2}-\d{2}"/g,
  )) {
    const time = normalizeMonteGigsPayloadTime(match[1]);
    if (time) times.set(match[2], time);
  }

  return times;
}

// Accepts only a well-formed clock value the source actually stated. "00:00" is deliberately
// rejected: it appears on records that otherwise look time-less, so we treat it as MonteGigs'
// "unset" placeholder rather than asserting a genuine midnight start we cannot verify.
function normalizeMonteGigsPayloadTime(raw: string) {
  if (raw === "null") return undefined;
  const match = /^"(\d{1,2}):(\d{2})"$/.exec(raw);
  if (!match) return undefined;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return undefined;
  const time = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  return time === "00:00" ? undefined : time;
}

// The numeric id leading the URL slug (/me/events/kotor/3638-20260804-...) is the payload record's
// own primary key, so the join is exact — never a title or date heuristic.
function eventIdFromMonteGigsUrl(sourceUrl: string) {
  return /\/(\d+)-\d{8}-/.exec(sourceUrl)?.[1];
}

function parseMonteGigsEvents(
  html: string,
  context: CityContext,
  now = new Date(),
): GoingOutParseResult {
  const source = getMonteGigsCitySource(context.city.id);
  if (!source) {
    return {
      events: [],
      recognized: false,
      records: 0,
      rejected: 0,
      warnings: ["montegigs-city-unsupported"],
    };
  }

  const listing = extractMonteGigsListingContent(html);
  const payloadTimes = extractMonteGigsEventTimes(html);
  const allEventLinks = findMonteGigsEventLinks(listing);
  const eventLinks = allEventLinks.filter(({ cityId }) => cityId === source.cityId);
  const recognized = eventLinks.length > 0;
  const events: GoingOutEvent[] = [];
  let rejected = 0;

  for (const eventLink of eventLinks) {
    const cardWindow = extractMonteGigsEventWindow(listing, eventLink, allEventLinks);
    const sourceUrl = new URL(eventLink.href, source.listingUrl).toString();
    const startDate = dateFromMonteGigsUrl(sourceUrl);
    const title =
      firstHeading(eventLink.content) ||
      plainText(eventLink.content) ||
      firstHeading(cardWindow) ||
      "";
    const imageUrl = monteGigsImageUrl(
      firstImage(eventLink.raw) || firstImage(cardWindow),
      source.listingUrl,
    );
    const event = normalizeGoingOutEvent({
      city: source.cityId,
      ...(imageUrl ? { imageUrl } : {}),
      sourceUrl,
      startDate: startDate ?? "",
      // Payload time first (the card markup carries none); the DOM reader stays as a fallback in
      // case MonteGigs ever prints a time again.
      startTime:
        payloadTimes.get(eventIdFromMonteGigsUrl(sourceUrl) ?? "") ?? extractTime(cardWindow),
      title,
      venue: extractVenue(cardWindow),
    });
    if (event) events.push(event);
    else rejected += 1;
  }

  return {
    events: selectUpcomingGoingOutEvents(events, now),
    recognized,
    records: eventLinks.length,
    rejected,
    warnings: [
      ...(recognized ? [] : ["montegigs-event-links-unavailable"]),
      ...(rejected > 0 ? ["montegigs-events-rejected"] : []),
    ],
  };
}

async function refreshMonteGigsGoingOut({
  cachePath,
  context,
  httpClient = createMonteGigsHttpClient(),
  now = new Date(),
}: {
  cachePath?: string;
  context: CityContext;
  httpClient?: GoingOutHttpClient;
  now?: Date;
}): Promise<GoingOutRefreshResult> {
  const source = getMonteGigsCitySource(context.city.id);
  if (!source) {
    return {
      acceptedEvents: 0,
      errorCode: "montegigs-city-unsupported",
      retainedPreviousSnapshot: false,
      snapshot: null,
      success: false,
      warnings: ["montegigs-city-unsupported"],
    };
  }

  const resolvedCachePath = cachePath ?? getGoingOutCachePath(source.cityId);
  const previous = await readGoingOutCacheSnapshot(resolvedCachePath, source.cityId);
  try {
    const response = await httpClient.get(source.listingUrl);
    assertMonteGigsListingUrl(response.finalUrl, source.cityId);
    const parsed = parseMonteGigsEvents(response.body, context, now);
    if (!parsed.recognized) {
      return retainPrevious(previous, "montegigs-parser-failed", parsed.warnings);
    }

    const snapshot: GoingOutCacheSnapshot = {
      cityId: source.cityId,
      events: sortAndDeduplicateGoingOutEvents(parsed.events),
      fetchedAt: now.toISOString(),
      lastSuccessfulRefreshAt: now.toISOString(),
      parserWarnings: parsed.warnings,
      schemaVersion: 1,
      sourceUrl: response.finalUrl,
    };
    await writeJsonCache(snapshot, resolvedCachePath);
    return {
      acceptedEvents: snapshot.events.length,
      retainedPreviousSnapshot: false,
      snapshot,
      success: true,
      warnings: parsed.warnings,
    };
  } catch (error) {
    return retainPrevious(
      previous,
      error instanceof MonteGigsFetchError ? error.code : "montegigs-refresh-failed",
      [error instanceof Error ? error.message : "montegigs-refresh-failed"],
    );
  }
}

async function getCachedMonteGigsGoingOut({
  cachePath,
  context,
  now = new Date(),
}: {
  cachePath?: string;
  context: CityContext;
  now?: Date;
}): Promise<GoingOutCacheResult> {
  const source = getMonteGigsCitySource(context.city.id);
  if (!source) return { events: [], state: "unavailable" };

  const snapshot = await readGoingOutCacheSnapshot(
    cachePath ?? getGoingOutCachePath(source.cityId),
    source.cityId,
  );
  if (!snapshot) return { events: [], state: "unavailable" };
  const state = calculateCacheFreshness(
    new Date(snapshot.fetchedAt),
    now,
    env.GOING_OUT_CACHE_FRESHNESS_MINUTES,
  );
  return {
    events: selectUpcomingGoingOutEvents(snapshot.events, now),
    lastSuccessfulRefreshAt: snapshot.lastSuccessfulRefreshAt,
    state: state === "unavailable" ? "unavailable" : state,
  };
}

async function readGoingOutCacheSnapshot(cachePath: string, cityId: MonteGigsSupportedCityId) {
  const snapshot = await readJsonCache<unknown>(cachePath);
  const parsed = goingOutCacheSnapshotSchema.safeParse(snapshot);
  return parsed.success && parsed.data.cityId === cityId ? parsed.data : null;
}

function retainPrevious(
  previous: GoingOutCacheSnapshot | null,
  errorCode: string,
  warnings: string[],
): GoingOutRefreshResult {
  return {
    acceptedEvents: previous?.events.length ?? 0,
    errorCode,
    retainedPreviousSnapshot: Boolean(previous),
    snapshot: previous
      ? {
          ...previous,
          lastRefreshError: errorCode,
          parserWarnings: [...previous.parserWarnings, ...warnings],
        }
      : null,
    success: false,
    warnings,
  };
}

function assertMonteGigsUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.hostname !== "staging.montegigs.me") {
    throw new MonteGigsFetchError(
      "montegigs-host-rejected",
      "Only the configured MonteGigs source is allowed.",
    );
  }
}

function assertMonteGigsListingUrl(value: string, cityId: MonteGigsSupportedCityId) {
  assertMonteGigsUrl(value);
  const source = monteGigsCitySources[cityId];
  if (new URL(value).pathname !== new URL(source.listingUrl).pathname) {
    throw new MonteGigsFetchError(
      "montegigs-city-source-rejected",
      "MonteGigs redirected to an unexpected city listing.",
    );
  }
}

function getMonteGigsCitySource(cityId: CityId) {
  return isMonteGigsSupportedCityId(cityId) ? monteGigsCitySources[cityId] : undefined;
}

function getGoingOutCachePath(cityId: MonteGigsSupportedCityId) {
  if (cityId === "podgorica") return env.GOING_OUT_CACHE_PATH;
  return resolveRuntimeCachePath(`montegigs-going-out-${cityId}.json`, env.RUNTIME_DATA_DIR);
}

function isMonteGigsSupportedCityId(cityId: CityId): cityId is MonteGigsSupportedCityId {
  return Object.hasOwn(monteGigsCitySources, cityId);
}

function monteGigsImageUrl(value: string | undefined, sourceUrl: string) {
  if (!value) return undefined;
  try {
    const url = new URL(value, sourceUrl);
    return url.protocol === "https:" && url.hostname === "staging.montegigs.me"
      ? url.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

function findMonteGigsEventLinks(value: string): MonteGigsEventLink[] {
  return [
    ...value.matchAll(
      /<a\b[^>]*href=["']([^"']*\/me\/events\/([a-z0-9-]+)\/\d+-\d{8}-[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
    ),
  ].flatMap((match) => {
    const index = match.index;
    const href = match[1];
    const cityId = match[2];
    const content = match[3];
    if (index === undefined || !href || !cityId || content === undefined) return [];
    return [{ cityId, content, href, index, raw: match[0] }];
  });
}

function extractMonteGigsListingContent(html: string) {
  const main = /<main\b[^>]*>([\s\S]*?)<\/main>/i.exec(html)?.[1] ?? html;
  return main.replace(
    /<(aside|footer|nav|noscript|script|style|svg|template)\b[\s\S]*?<\/\1>/gi,
    " ",
  );
}

function extractMonteGigsEventWindow(
  listing: string,
  eventLink: MonteGigsEventLink,
  eventLinks: readonly MonteGigsEventLink[],
) {
  const card = findContainingEventCard(listing, eventLink);
  if (card) return card;

  const eventIndex = eventLinks.indexOf(eventLink);
  const nextIndex = eventLinks[eventIndex + 1]?.index ?? listing.length;
  return listing.slice(eventLink.index, Math.min(nextIndex, eventLink.index + 6_000));
}

function findContainingEventCard(listing: string, eventLink: MonteGigsEventLink) {
  const candidates = [
    ...findElementBlocks(listing, "article"),
    ...findElementBlocks(listing, "li"),
    ...findClassEventCardBlocks(listing),
  ]
    .filter(({ end, start, value }) => {
      const containsLink = start <= eventLink.index && eventLink.index < end;
      return containsLink && findMonteGigsEventLinks(value).length === 1;
    })
    .sort((left, right) => left.value.length - right.value.length);
  return candidates[0]?.value;
}

function findElementBlocks(value: string, tagName: "article" | "li") {
  return [
    ...value.matchAll(new RegExp(`<${tagName}\\b[^>]*>[\\s\\S]*?<\\/${tagName}>`, "gi")),
  ].flatMap((match) => {
    const start = match.index;
    if (start === undefined) return [];
    return [{ end: start + match[0].length, start, value: match[0] }];
  });
}

function findClassEventCardBlocks(value: string) {
  return [
    ...value.matchAll(
      /<div\b(?=[^>]*\bclass=["'][^"']*\b(?:event-card|event-item)\b[^"']*["'])[^>]*>[\s\S]*?<\/div>/gi,
    ),
  ].flatMap((match) => {
    const start = match.index;
    if (start === undefined) return [];
    return [{ end: start + match[0].length, start, value: match[0] }];
  });
}

function dateFromMonteGigsUrl(sourceUrl: string) {
  const encodedDate = sourceUrl.match(/\/\d+-(\d{4})(\d{2})(\d{2})-/)?.slice(1);
  if (!encodedDate) return undefined;
  const [year, month, day] = encodedDate;
  const date = `${year}-${month}-${day}`;
  return Number.isNaN(Date.parse(`${date}T12:00:00Z`)) ? undefined : date;
}

function plainText(value: string) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}

function firstHeading(value: string) {
  return plainText(value.match(/<h[1-4]\b[^>]*>([\s\S]*?)<\/h[1-4]>/i)?.[1] ?? "");
}

function firstImage(value: string) {
  return value.match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i)?.[1];
}

function extractTime(value: string) {
  const match = extractEventMetadata(value).match(/\b(?:u|od)\s*(\d{1,2})[:.](\d{2})\b/i);
  return match ? `${match[1]}:${match[2]}` : undefined;
}

function extractVenue(value: string) {
  const text = extractEventMetadata(value);
  return text
    .match(
      /\b\d{1,2}\.?\s+(?:jan|feb|mar|apr|maj|jun|jul|avg|sep|okt|nov|dec)[a-z]*\s*•\s*([^•]+)/i,
    )?.[1]
    ?.trim();
}

function extractEventMetadata(value: string) {
  const elements = [...value.matchAll(/<(div|p|span|time)\b[^>]*>([\s\S]*?)<\/\1>/gi)].map(
    (match) => plainText(match[2]),
  );
  return (
    elements.find((text) =>
      /\b\d{1,2}\.?\s+(?:jan|feb|mar|apr|maj|jun|jul|avg|sep|okt|nov|dec)[a-z]*\s*•/i.test(text),
    ) ?? ""
  );
}

const goingOutEventSchema = z.object({
  city: z.enum(["bar", "podgorica", "budva", "kotor", "tivat"]),
  id: z.string().min(1),
  imageUrl: z.string().url().optional(),
  sourceName: z.literal("MonteGigs"),
  sourceUrl: z.string().url(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startsAt: z.string().datetime().optional(),
  title: z.string().min(1),
  venue: z.string().min(1).optional(),
});

const goingOutCacheSnapshotSchema = z.object({
  cityId: z.enum(["bar", "podgorica", "budva", "kotor", "tivat"]).default("podgorica"),
  events: z.array(goingOutEventSchema),
  fetchedAt: z.string().datetime(),
  lastRefreshError: z.string().optional(),
  lastSuccessfulRefreshAt: z.string().datetime(),
  parserWarnings: z.array(z.string()),
  schemaVersion: z.literal(1),
  sourceUrl: z.string().url(),
});

export {
  MonteGigsFetchError,
  assertMonteGigsListingUrl,
  assertMonteGigsUrl,
  createMonteGigsHttpClient,
  getCachedMonteGigsGoingOut,
  getGoingOutCachePath,
  getMonteGigsCitySource,
  isMonteGigsSupportedCityId,
  monteGigsCitySources,
  parseMonteGigsEvents,
  readGoingOutCacheSnapshot,
  refreshMonteGigsGoingOut,
  type GoingOutCacheResult,
  type GoingOutCacheSnapshot,
  type GoingOutCacheState,
  type GoingOutHttpClient,
  type GoingOutHttpResponse,
  type GoingOutRefreshResult,
  type MonteGigsSupportedCityId,
};
