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
import { parseMonteGigsEventDetail, type MonteGigsEventDetail } from "./montegigs-event-details.ts";

const maximumResponseLength = 1_500_000;
const maximumDetailRequestsPerCityRefresh = 12;
const detailRequestConcurrency = 3;
const detailCacheFreshnessHours = 12;
const detailCacheStaleFallbackHours = 72;
const detailCacheRetentionDays = 14;

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
  // Verified read-only against the live listing before enabling: it returns HTTP 200 with real
  // upcoming Ulcinj events, and the embedded payload carries their start times.
  ulcinj: {
    cityId: "ulcinj",
    listingUrl: "https://staging.montegigs.me/me/events/ulcinj",
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

interface MonteGigsPayloadEvent {
  eventType?: string;
  genre?: string;
  isFree?: boolean;
  performers?: readonly string[];
  priceLabel?: string;
  startTime?: string;
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
  detailCoverage?: GoingOutDetailCoverage;
  errorCode?: string;
  retainedPreviousSnapshot: boolean;
  snapshot: GoingOutCacheSnapshot | null;
  success: boolean;
  warnings: string[];
}

interface GoingOutDetailCoverage {
  addressCount: number;
  candidateEvents: number;
  descriptionCount: number;
  detailCacheHits: number;
  detailCacheMisses: number;
  detailCacheStale: number;
  detailCacheStaleFallbacks: number;
  detailCacheWriteFailures: number;
  detailEnrichedEvents: number;
  detailFetchAttempted: number;
  detailFetchSucceeded: number;
  informationUrlCount: number;
  organizerCount: number;
}

interface MonteGigsDetailCacheEntry extends MonteGigsEventDetail {
  fetchedAt: string;
  lastSeenAt: string;
  sourceEventId: string;
  sourceUrl: string;
}

interface MonteGigsDetailCacheSnapshot {
  cityId: MonteGigsSupportedCityId;
  entries: MonteGigsDetailCacheEntry[];
  schemaVersion: 1;
  updatedAt: string;
}

interface MonteGigsDetailCacheReadResult {
  entries: ReadonlyMap<string, MonteGigsDetailCacheEntry>;
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

// MonteGigs renders each card as "date • venue" but embeds its listing data in the hydration
// payload. This parser reads only the explicit per-event values accepted by the Going Out model:
// numeric source id, time, artists, event type, genre and entry cost. It intentionally does not
// promote venue details, status, contacts, addresses or other payload fields in this phase.
//
// Best-effort by construction: an absent, renamed or unparseable payload yields an empty map and
// collection proceeds from the rendered listing exactly as before.
function extractMonteGigsEventPayloads(html: string): ReadonlyMap<string, MonteGigsPayloadEvent> {
  const payloads = new Map<string, MonteGigsPayloadEvent>();
  const payload = html.replace(/\\"/g, '"');

  for (const match of payload.matchAll(/"events"\s*:\s*\[/g)) {
    const openingBracket = (match.index ?? 0) + match[0].lastIndexOf("[");
    const serializedEvents = extractJsonArray(payload, openingBracket);
    if (!serializedEvents) continue;

    try {
      const events: unknown = JSON.parse(serializedEvents);
      if (!Array.isArray(events)) continue;

      for (const event of events) {
        if (!isPayloadRecord(event)) continue;
        const sourceEventId = normalizeMonteGigsPayloadId(event.id);
        if (!sourceEventId) continue;

        const cost = normalizeMonteGigsPayloadText(event.cost);
        const startTime = normalizeMonteGigsPayloadTime(event.time);
        const eventType = normalizeMonteGigsPayloadText(event.event_type);
        const genre = normalizeMonteGigsPayloadText(event.genre);
        const performers = extractMonteGigsPerformers(event.eventArtists);
        const isFree = cost?.toLocaleLowerCase("en-US") === "free" ? true : undefined;
        payloads.set(sourceEventId, {
          ...(startTime ? { startTime } : {}),
          ...(eventType ? { eventType } : {}),
          ...(genre ? { genre } : {}),
          ...(isFree ? { isFree } : {}),
          ...(performers ? { performers } : {}),
          ...(!isFree && cost ? { priceLabel: cost } : {}),
        });
      }
    } catch {
      // Hydration enrichment is optional; an invalid payload never invalidates the listing.
    }
  }

  return payloads;
}

function extractJsonArray(value: string, openingBracket: number) {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = openingBracket; index < value.length; index += 1) {
    const character = value[index];
    if (!character) continue;

    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }

    if (character === '"') inString = true;
    else if (character === "[") depth += 1;
    else if (character === "]") {
      depth -= 1;
      if (depth === 0) return value.slice(openingBracket, index + 1);
    }
  }

  return undefined;
}

function isPayloadRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeMonteGigsPayloadId(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? String(value)
    : typeof value === "string" && /^\d+$/u.test(value.trim())
      ? value.trim()
      : undefined;
}

function normalizeMonteGigsPayloadText(value: unknown) {
  const normalized = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  return normalized || undefined;
}

function extractMonteGigsPerformers(value: unknown) {
  if (!Array.isArray(value)) return undefined;

  const performers = value.flatMap((performer) => {
    if (!isPayloadRecord(performer)) return [];
    const name = normalizeMonteGigsPayloadText(performer.name);
    return name ? [name] : [];
  });

  return performers.length > 0 ? performers : undefined;
}

// Accepts only a well-formed clock value the source actually stated. "00:00" is deliberately
// rejected: it appears on records that otherwise look time-less, so we treat it as MonteGigs'
// "unset" placeholder rather than asserting a genuine midnight start we cannot verify.
function normalizeMonteGigsPayloadTime(raw: unknown) {
  if (typeof raw !== "string") return undefined;
  const match = /^(\d{1,2}):(\d{2})$/.exec(raw.trim());
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
  const payloadEvents = extractMonteGigsEventPayloads(html);
  const allEventLinks = findMonteGigsEventLinks(listing);
  const eventLinks = allEventLinks.filter(({ cityId }) => cityId === source.cityId);
  const recognized = eventLinks.length > 0;
  const events: GoingOutEvent[] = [];
  let rejected = 0;

  for (const eventLink of eventLinks) {
    const cardWindow = extractMonteGigsEventWindow(listing, eventLink, allEventLinks);
    const sourceUrl = new URL(eventLink.href, source.listingUrl).toString();
    const startDate = dateFromMonteGigsUrl(sourceUrl);
    const sourceEventId = eventIdFromMonteGigsUrl(sourceUrl);
    const payloadEvent = sourceEventId ? payloadEvents.get(sourceEventId) : undefined;
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
      ...(payloadEvent?.eventType ? { eventType: payloadEvent.eventType } : {}),
      ...(payloadEvent?.genre ? { genre: payloadEvent.genre } : {}),
      ...(imageUrl ? { imageUrl } : {}),
      ...(payloadEvent?.isFree ? { isFree: true } : {}),
      ...(payloadEvent?.performers ? { performers: payloadEvent.performers } : {}),
      ...(payloadEvent?.priceLabel ? { priceLabel: payloadEvent.priceLabel } : {}),
      ...(sourceEventId ? { sourceEventId } : {}),
      sourceUrl,
      startDate: startDate ?? "",
      // Payload time first (the card markup carries none); the DOM reader stays as a fallback in
      // case MonteGigs ever prints a time again.
      startTime: payloadEvent?.startTime ?? extractTime(cardWindow),
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

async function enrichMonteGigsEventDetails({
  cityId,
  detailCachePath,
  events,
  httpClient,
  now,
}: {
  cityId: MonteGigsSupportedCityId;
  detailCachePath: string;
  events: readonly GoingOutEvent[];
  httpClient: GoingOutHttpClient;
  now: Date;
}) {
  const sourceCandidates = createDetailCandidates(events);
  const detailCache = await readMonteGigsDetailCache(detailCachePath, cityId);
  const detailsBySourceEventId = new Map<string, MonteGigsEventDetail>();
  const staleEntries = new Map<string, MonteGigsDetailCacheEntry>();
  const missingCandidates: DetailCandidate[] = [];
  const staleCandidates: DetailCandidate[] = [];
  let detailCacheHits = 0;

  for (const candidate of sourceCandidates) {
    const cached = detailCache.entries.get(candidate.sourceEventId);
    if (!cached || !isMatchingMonteGigsDetailCacheEntry(cached, candidate)) {
      missingCandidates.push(candidate);
      continue;
    }

    if (isMonteGigsDetailCacheFresh(cached, now)) {
      detailCacheHits += 1;
      detailsBySourceEventId.set(candidate.sourceEventId, detailFieldsFromCache(cached));
      continue;
    }

    staleCandidates.push(candidate);
    staleEntries.set(candidate.sourceEventId, cached);
  }

  const networkCandidates = [...missingCandidates, ...staleCandidates].slice(
    0,
    maximumDetailRequestsPerCityRefresh,
  );
  const fetchedDetails = new Map<string, MonteGigsEventDetail>();
  const staleFallbackSourceEventIds = new Set<string>();
  const networkSourceEventIds = new Set(
    networkCandidates.map((candidate) => candidate.sourceEventId),
  );
  for (const candidate of staleCandidates) {
    if (networkSourceEventIds.has(candidate.sourceEventId)) continue;
    const stale = staleEntries.get(candidate.sourceEventId);
    if (stale && isMonteGigsDetailCacheUsableAsFallback(stale, now)) {
      detailsBySourceEventId.set(candidate.sourceEventId, detailFieldsFromCache(stale));
      staleFallbackSourceEventIds.add(candidate.sourceEventId);
    }
  }
  let detailFetchSucceeded = 0;

  await mapWithConcurrency(networkCandidates, detailRequestConcurrency, async (candidate) => {
    try {
      const response = await httpClient.get(candidate.sourceUrl);
      assertMonteGigsDetailUrl(response.finalUrl, candidate.sourceUrl);
      const details = parseMonteGigsEventDetail(response.body, {
        sourceEventId: candidate.sourceEventId,
        sourceUrl: candidate.sourceUrl,
        ...(candidate.event.venue ? { venue: candidate.event.venue } : {}),
      });
      fetchedDetails.set(candidate.sourceEventId, details);
      detailsBySourceEventId.set(candidate.sourceEventId, details);
      detailFetchSucceeded += 1;
    } catch {
      const stale = staleEntries.get(candidate.sourceEventId);
      if (stale && isMonteGigsDetailCacheUsableAsFallback(stale, now)) {
        detailsBySourceEventId.set(candidate.sourceEventId, detailFieldsFromCache(stale));
        staleFallbackSourceEventIds.add(candidate.sourceEventId);
      }
      // Detail enrichment is intentionally fail-open. The listing record remains authoritative.
    }
  });

  const enrichedEvents = events.map((event) => ({
    ...event,
    ...detailsBySourceEventId.get(event.sourceEventId),
  }));
  const detailCoverage: GoingOutDetailCoverage = {
    addressCount: enrichedEvents.filter((event) => Boolean(event.address)).length,
    candidateEvents: sourceCandidates.length,
    descriptionCount: enrichedEvents.filter((event) => Boolean(event.description)).length,
    detailCacheHits,
    detailCacheMisses: missingCandidates.length,
    detailCacheStale: staleCandidates.length,
    detailCacheStaleFallbacks: staleFallbackSourceEventIds.size,
    detailCacheWriteFailures: 0,
    detailEnrichedEvents: enrichedEvents.filter(hasMonteGigsDetailFields).length,
    detailFetchAttempted: networkCandidates.length,
    detailFetchSucceeded,
    informationUrlCount: enrichedEvents.filter((event) => Boolean(event.informationUrl)).length,
    organizerCount: enrichedEvents.filter((event) => Boolean(event.organizer)).length,
  };

  const cacheWriteFailed = await writeMonteGigsDetailCache({
    cachePath: detailCachePath,
    cityId,
    currentCandidates: sourceCandidates,
    entries: detailCache.entries,
    fetchedDetails,
    now,
  });
  if (cacheWriteFailed) detailCoverage.detailCacheWriteFailures = 1;

  return {
    detailCoverage,
    events: enrichedEvents,
    warnings: [
      ...(detailFetchSucceeded === networkCandidates.length
        ? []
        : ["montegigs-detail-enrichment-incomplete"]),
      ...(cacheWriteFailed ? ["montegigs-detail-cache-write-failed"] : []),
    ],
  };
}

interface DetailCandidate {
  event: GoingOutEvent;
  sourceEventId: string;
  sourceUrl: string;
}

function createDetailCandidates(events: readonly GoingOutEvent[]) {
  const candidates = new Map<string, DetailCandidate>();
  for (const event of [...events].sort(compareGoingOutEventsByStart)) {
    if (!candidates.has(event.sourceEventId)) {
      candidates.set(event.sourceEventId, {
        event,
        sourceEventId: event.sourceEventId,
        sourceUrl: event.sourceUrl,
      });
    }
  }
  return [...candidates.values()];
}

function compareGoingOutEventsByStart(left: GoingOutEvent, right: GoingOutEvent) {
  return (
    left.startDate.localeCompare(right.startDate) ||
    (left.startsAt ?? "").localeCompare(right.startsAt ?? "") ||
    left.sourceEventId.localeCompare(right.sourceEventId)
  );
}

function detailFieldsFromCache(entry: MonteGigsDetailCacheEntry): MonteGigsEventDetail {
  return {
    ...(entry.address ? { address: entry.address } : {}),
    ...(entry.description ? { description: entry.description } : {}),
    ...(entry.informationUrl ? { informationUrl: entry.informationUrl } : {}),
    ...(entry.organizer ? { organizer: entry.organizer } : {}),
  };
}

function hasMonteGigsDetailFields(event: GoingOutEvent) {
  return Boolean(event.address || event.description || event.informationUrl || event.organizer);
}

function isMatchingMonteGigsDetailCacheEntry(
  entry: MonteGigsDetailCacheEntry,
  candidate: DetailCandidate,
) {
  return (
    entry.sourceEventId === candidate.sourceEventId &&
    eventIdFromMonteGigsUrl(entry.sourceUrl) === entry.sourceEventId &&
    eventIdFromMonteGigsUrl(candidate.sourceUrl) === candidate.sourceEventId &&
    monteGigsCityIdFromSourceUrl(entry.sourceUrl) === candidate.event.city &&
    monteGigsCityIdFromSourceUrl(candidate.sourceUrl) === candidate.event.city
  );
}

function detailCacheAgeMs(entry: MonteGigsDetailCacheEntry, now: Date) {
  return now.getTime() - new Date(entry.fetchedAt).getTime();
}

function isMonteGigsDetailCacheFresh(entry: MonteGigsDetailCacheEntry, now: Date) {
  const age = detailCacheAgeMs(entry, now);
  return Number.isFinite(age) && age <= detailCacheFreshnessHours * 60 * 60_000;
}

function isMonteGigsDetailCacheUsableAsFallback(entry: MonteGigsDetailCacheEntry, now: Date) {
  const age = detailCacheAgeMs(entry, now);
  return Number.isFinite(age) && age <= detailCacheStaleFallbackHours * 60 * 60_000;
}

async function readMonteGigsDetailCache(
  cachePath: string,
  cityId: MonteGigsSupportedCityId | undefined,
): Promise<MonteGigsDetailCacheReadResult> {
  if (!cityId) return { entries: new Map() };

  const raw = await readJsonCache<unknown>(cachePath);
  const header = monteGigsDetailCacheSnapshotHeaderSchema.safeParse(raw);
  if (!header.success || header.data.cityId !== cityId) return { entries: new Map() };

  const entries = new Map<string, MonteGigsDetailCacheEntry>();
  for (const value of header.data.entries) {
    const parsed = monteGigsDetailCacheEntrySchema.safeParse(value);
    if (!parsed.success) continue;
    const entry = parsed.data;
    if (
      !isMonteGigsDetailCacheSourceUrl(entry.sourceUrl) ||
      eventIdFromMonteGigsUrl(entry.sourceUrl) !== entry.sourceEventId ||
      monteGigsCityIdFromSourceUrl(entry.sourceUrl) !== cityId ||
      (entry.informationUrl !== undefined &&
        !isValidExternalInformationUrl(entry.informationUrl, entry.sourceUrl))
    ) {
      continue;
    }

    const previous = entries.get(entry.sourceEventId);
    if (!previous || entry.fetchedAt > previous.fetchedAt) entries.set(entry.sourceEventId, entry);
  }
  return { entries };
}

function isMonteGigsDetailCacheSourceUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "staging.montegigs.me";
  } catch {
    return false;
  }
}

function monteGigsCityIdFromSourceUrl(sourceUrl: string) {
  return /\/me\/events\/([a-z0-9-]+)\/\d+-\d{8}-/u.exec(sourceUrl)?.[1];
}

async function writeMonteGigsDetailCache({
  cachePath,
  cityId,
  currentCandidates,
  entries,
  fetchedDetails,
  now,
}: {
  cachePath: string;
  cityId: MonteGigsSupportedCityId | undefined;
  currentCandidates: readonly DetailCandidate[];
  entries: ReadonlyMap<string, MonteGigsDetailCacheEntry>;
  fetchedDetails: ReadonlyMap<string, MonteGigsEventDetail>;
  now: Date;
}) {
  if (!cityId) return false;

  const currentBySourceEventId = new Map(
    currentCandidates.map((candidate) => [candidate.sourceEventId, candidate]),
  );
  const retainedEntries = [...entries.values()].flatMap((entry) => {
    const current = currentBySourceEventId.get(entry.sourceEventId);
    if (current) {
      return [
        {
          ...entry,
          lastSeenAt: now.toISOString(),
          sourceUrl: current.sourceUrl,
        },
      ];
    }
    return isMonteGigsDetailCacheWithinRetention(entry, now) ? [entry] : [];
  });
  const bySourceEventId = new Map(
    retainedEntries.map((entry) => [entry.sourceEventId, entry] as const),
  );
  for (const [sourceEventId, details] of fetchedDetails) {
    const current = currentBySourceEventId.get(sourceEventId);
    if (!current) continue;
    bySourceEventId.set(sourceEventId, {
      ...details,
      fetchedAt: now.toISOString(),
      lastSeenAt: now.toISOString(),
      sourceEventId,
      sourceUrl: current.sourceUrl,
    });
  }

  const snapshot: MonteGigsDetailCacheSnapshot = {
    cityId,
    entries: [...bySourceEventId.values()].sort((left, right) =>
      left.sourceEventId.localeCompare(right.sourceEventId),
    ),
    schemaVersion: 1,
    updatedAt: now.toISOString(),
  };
  try {
    await writeJsonCache(snapshot, cachePath);
    return false;
  } catch {
    return true;
  }
}

function isMonteGigsDetailCacheWithinRetention(entry: MonteGigsDetailCacheEntry, now: Date) {
  const age = now.getTime() - new Date(entry.lastSeenAt).getTime();
  return Number.isFinite(age) && age <= detailCacheRetentionDays * 24 * 60 * 60_000;
}

async function mapWithConcurrency<Value>(
  values: readonly Value[],
  concurrency: number,
  operation: (value: Value) => Promise<void>,
) {
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < values.length) {
      const value = values[nextIndex];
      nextIndex += 1;
      if (value !== undefined) await operation(value);
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, () => worker()));
}

async function refreshMonteGigsGoingOut({
  cachePath,
  context,
  detailCachePath,
  httpClient = createMonteGigsHttpClient(),
  now = new Date(),
}: {
  cachePath?: string;
  context: CityContext;
  detailCachePath?: string;
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
  const resolvedDetailCachePath =
    detailCachePath ??
    (cachePath
      ? getGoingOutDetailCachePathForSnapshot(cachePath)
      : getGoingOutDetailCachePath(source.cityId));
  const previous = await readGoingOutCacheSnapshot(resolvedCachePath, source.cityId);
  try {
    const response = await httpClient.get(source.listingUrl);
    assertMonteGigsListingUrl(response.finalUrl, source.cityId);
    const parsed = parseMonteGigsEvents(response.body, context, now);
    if (!parsed.recognized) {
      return retainPrevious(previous, "montegigs-parser-failed", parsed.warnings);
    }
    const enriched = await enrichMonteGigsEventDetails({
      cityId: source.cityId,
      detailCachePath: resolvedDetailCachePath,
      events: parsed.events,
      httpClient,
      now,
    });

    const snapshot: GoingOutCacheSnapshot = {
      cityId: source.cityId,
      events: sortAndDeduplicateGoingOutEvents(enriched.events),
      fetchedAt: now.toISOString(),
      lastSuccessfulRefreshAt: now.toISOString(),
      parserWarnings: [...parsed.warnings, ...enriched.warnings],
      schemaVersion: 1,
      sourceUrl: response.finalUrl,
    };
    await writeJsonCache(snapshot, resolvedCachePath);
    return {
      acceptedEvents: snapshot.events.length,
      detailCoverage: enriched.detailCoverage,
      retainedPreviousSnapshot: false,
      snapshot,
      success: true,
      warnings: snapshot.parserWarnings,
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

async function readGoingOutCacheSnapshot(
  cachePath: string,
  cityId: MonteGigsSupportedCityId,
): Promise<GoingOutCacheSnapshot | null> {
  const snapshot = await readJsonCache<unknown>(cachePath);
  const parsed = goingOutCacheSnapshotSchema.safeParse(snapshot);
  if (!parsed.success || parsed.data.cityId !== cityId) return null;

  const events: GoingOutEvent[] = [];
  for (const event of parsed.data.events) {
    const sourceEventId = eventIdFromMonteGigsUrl(event.sourceUrl);
    if (
      !sourceEventId ||
      (event.sourceEventId !== undefined && event.sourceEventId !== sourceEventId) ||
      (event.informationUrl !== undefined &&
        !isValidExternalInformationUrl(event.informationUrl, event.sourceUrl))
    ) {
      return null;
    }
    events.push({ ...event, sourceEventId });
  }

  return { ...parsed.data, events };
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

function assertMonteGigsDetailUrl(value: string, sourceUrl: string) {
  assertMonteGigsUrl(value);
  if (new URL(value).pathname !== new URL(sourceUrl).pathname) {
    throw new MonteGigsFetchError(
      "montegigs-city-source-rejected",
      "MonteGigs redirected to an unexpected event detail.",
    );
  }
}

function isValidExternalInformationUrl(value: string, sourceUrl: string) {
  try {
    const url = new URL(value);
    const source = new URL(sourceUrl);
    return (
      url.protocol === "https:" &&
      url.toString() !== source.toString() &&
      url.hostname !== source.hostname
    );
  } catch {
    return false;
  }
}

function getMonteGigsCitySource(cityId: CityId) {
  return isMonteGigsSupportedCityId(cityId) ? monteGigsCitySources[cityId] : undefined;
}

function getGoingOutCachePath(cityId: MonteGigsSupportedCityId) {
  if (cityId === "podgorica") return env.GOING_OUT_CACHE_PATH;
  return resolveRuntimeCachePath(`montegigs-going-out-${cityId}.json`, env.RUNTIME_DATA_DIR);
}

function getGoingOutDetailCachePath(cityId: MonteGigsSupportedCityId) {
  return resolveRuntimeCachePath(
    `montegigs-going-out-${cityId}-detail-enrichment.json`,
    env.RUNTIME_DATA_DIR,
  );
}

function getGoingOutDetailCachePathForSnapshot(cachePath: string) {
  return `${cachePath}.detail-enrichment.json`;
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
  address: z.string().min(1).max(500).optional(),
  city: z.enum(["bar", "podgorica", "budva", "kotor", "tivat", "ulcinj"]),
  description: z.string().min(1).max(4_000).optional(),
  eventType: z.string().min(1).optional(),
  genre: z.string().min(1).optional(),
  id: z.string().min(1),
  imageUrl: z.string().url().optional(),
  informationUrl: z
    .string()
    .url()
    .refine((value) => new URL(value).protocol === "https:")
    .optional(),
  isFree: z.literal(true).optional(),
  organizer: z.string().min(1).max(250).optional(),
  performers: z.array(z.string().min(1)).min(1).optional(),
  priceLabel: z.string().min(1).optional(),
  sourceName: z.literal("MonteGigs"),
  sourceEventId: z.string().regex(/^\d+$/).optional(),
  sourceUrl: z.string().url(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startsAt: z.string().datetime().optional(),
  title: z.string().min(1),
  venue: z.string().min(1).optional(),
});

const goingOutCacheSnapshotSchema = z.object({
  cityId: z.enum(["bar", "podgorica", "budva", "kotor", "tivat", "ulcinj"]).default("podgorica"),
  events: z.array(goingOutEventSchema),
  fetchedAt: z.string().datetime(),
  lastRefreshError: z.string().optional(),
  lastSuccessfulRefreshAt: z.string().datetime(),
  parserWarnings: z.array(z.string()),
  schemaVersion: z.literal(1),
  sourceUrl: z.string().url(),
});

const monteGigsDetailCacheEntrySchema = z.object({
  address: z.string().min(1).max(500).optional(),
  description: z.string().min(1).max(4_000).optional(),
  fetchedAt: z.string().datetime(),
  informationUrl: z
    .string()
    .url()
    .refine((value) => new URL(value).protocol === "https:")
    .optional(),
  lastSeenAt: z.string().datetime(),
  organizer: z.string().min(1).max(250).optional(),
  sourceEventId: z.string().regex(/^\d+$/),
  sourceUrl: z.string().url(),
});

const monteGigsDetailCacheSnapshotHeaderSchema = z.object({
  cityId: z.enum(["bar", "podgorica", "budva", "kotor", "tivat", "ulcinj"]),
  entries: z.array(z.unknown()),
  schemaVersion: z.literal(1),
  updatedAt: z.string().datetime(),
});

export {
  MonteGigsFetchError,
  assertMonteGigsDetailUrl,
  assertMonteGigsListingUrl,
  assertMonteGigsUrl,
  createMonteGigsHttpClient,
  getCachedMonteGigsGoingOut,
  getGoingOutCachePath,
  getGoingOutDetailCachePath,
  getMonteGigsCitySource,
  isMonteGigsSupportedCityId,
  monteGigsCitySources,
  parseMonteGigsEvents,
  readGoingOutCacheSnapshot,
  readMonteGigsDetailCache,
  refreshMonteGigsGoingOut,
  type GoingOutCacheResult,
  type GoingOutCacheSnapshot,
  type GoingOutCacheState,
  type GoingOutDetailCoverage,
  type GoingOutHttpClient,
  type GoingOutHttpResponse,
  type GoingOutRefreshResult,
  type MonteGigsDetailCacheEntry,
  type MonteGigsDetailCacheSnapshot,
  type MonteGigsSupportedCityId,
};
