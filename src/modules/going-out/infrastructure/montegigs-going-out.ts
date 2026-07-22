import { z } from "zod";

import { env } from "../../../config/env.ts";
import {
  calculateCacheFreshness,
  readJsonCache,
  writeJsonCache,
} from "../../../shared/lib/cache.ts";

import {
  normalizeGoingOutEvent,
  selectUpcomingGoingOutEvents,
  sortAndDeduplicateGoingOutEvents,
  type GoingOutEvent,
} from "../domain/going-out-event.ts";

const monteGigsPodgoricaUrl = "https://staging.montegigs.me/me/events/podgorica";
const defaultGoingOutCachePath = env.GOING_OUT_CACHE_PATH;
const maximumResponseLength = 1_500_000;

type GoingOutCacheState = "fresh" | "stale" | "unavailable";

interface GoingOutCacheSnapshot {
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

function parseMonteGigsPodgoricaEvents(html: string, now = new Date()): GoingOutParseResult {
  const eventLinks = [
    ...html.matchAll(
      /<a\b[^>]*href=["']([^"']*\/me\/events\/podgorica\/\d+-\d{8}-[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
    ),
  ];
  const recognized = eventLinks.length > 0;
  const events: GoingOutEvent[] = [];
  let rejected = 0;

  for (const [index, match] of eventLinks.entries()) {
    const nextIndex = eventLinks[index + 1]?.index ?? html.length;
    const cardWindow = html.slice(
      match.index ?? 0,
      Math.min(nextIndex, (match.index ?? 0) + 6_000),
    );
    const sourceUrl = new URL(match[1], monteGigsPodgoricaUrl).toString();
    const startDate = dateFromMonteGigsUrl(sourceUrl);
    const title = plainText(match[2]) || firstHeading(cardWindow) || "";
    const imageUrl = monteGigsImageUrl(firstImage(match[0]) || firstImage(cardWindow));
    const event = normalizeGoingOutEvent({
      ...(imageUrl ? { imageUrl } : {}),
      sourceUrl,
      startDate: startDate ?? "",
      startTime: extractTime(cardWindow),
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
  cachePath = defaultGoingOutCachePath,
  httpClient = createMonteGigsHttpClient(),
  now = new Date(),
}: {
  cachePath?: string;
  httpClient?: GoingOutHttpClient;
  now?: Date;
} = {}): Promise<GoingOutRefreshResult> {
  const previous = await readGoingOutCacheSnapshot(cachePath);
  try {
    const response = await httpClient.get(monteGigsPodgoricaUrl);
    const parsed = parseMonteGigsPodgoricaEvents(response.body, now);
    if (!parsed.recognized) {
      return retainPrevious(previous, "montegigs-parser-failed", parsed.warnings);
    }

    const snapshot: GoingOutCacheSnapshot = {
      events: sortAndDeduplicateGoingOutEvents(parsed.events),
      fetchedAt: now.toISOString(),
      lastSuccessfulRefreshAt: now.toISOString(),
      parserWarnings: parsed.warnings,
      schemaVersion: 1,
      sourceUrl: response.finalUrl,
    };
    await writeJsonCache(snapshot, cachePath);
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

async function getCachedMonteGigsGoingOut(
  cachePath = defaultGoingOutCachePath,
  now = new Date(),
): Promise<GoingOutCacheResult> {
  const snapshot = await readGoingOutCacheSnapshot(cachePath);
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

async function readGoingOutCacheSnapshot(cachePath = defaultGoingOutCachePath) {
  const snapshot = await readJsonCache<unknown>(cachePath);
  const parsed = goingOutCacheSnapshotSchema.safeParse(snapshot);
  return parsed.success ? parsed.data : null;
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

function monteGigsImageUrl(value: string | undefined) {
  if (!value) return undefined;
  try {
    const url = new URL(value, monteGigsPodgoricaUrl);
    return url.protocol === "https:" && url.hostname === "staging.montegigs.me"
      ? url.toString()
      : undefined;
  } catch {
    return undefined;
  }
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
  const match = value.match(/\b(?:u|od)\s*(\d{1,2})[:.](\d{2})\b/i);
  return match ? `${match[1]}:${match[2]}` : undefined;
}

function extractVenue(value: string) {
  const text = plainText(value);
  return text
    .match(
      /\b\d{1,2}\.?\s+(?:jan|feb|mar|apr|maj|jun|jul|avg|sep|okt|nov|dec)[a-z]*\s*•\s*([^•]+)/i,
    )?.[1]
    ?.trim();
}

const goingOutEventSchema = z.object({
  city: z.literal("podgorica"),
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
  assertMonteGigsUrl,
  createMonteGigsHttpClient,
  getCachedMonteGigsGoingOut,
  monteGigsPodgoricaUrl,
  parseMonteGigsPodgoricaEvents,
  readGoingOutCacheSnapshot,
  refreshMonteGigsGoingOut,
  type GoingOutCacheResult,
  type GoingOutCacheSnapshot,
  type GoingOutCacheState,
  type GoingOutHttpClient,
  type GoingOutHttpResponse,
  type GoingOutRefreshResult,
};
