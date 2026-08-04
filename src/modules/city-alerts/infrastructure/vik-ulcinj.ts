import { createHash } from "node:crypto";
import { dirname } from "node:path";

import { env } from "@/config/env";
import type { CityAlert } from "@/modules/city-alerts/domain/city-alert";
import { deserializeCityAlerts } from "@/modules/city-alerts/infrastructure/city-alert-cache-deserialization";
import { isCitySupportedByProvider } from "@/shared/config/cities";
import {
  calculateCacheFreshness,
  nodeFileSystem,
  writeJsonCache,
  type CacheFileSystem,
} from "@/shared/lib/cache";
import { acquireRefreshLock } from "@/shared/lib/refresh-lock";
import type { CityContext } from "@/shared/types/city";
import type { ProviderMetadata } from "@/shared/types/provider";

const vikUlcinjOrigin = "https://vik-ulcinj.me";
const vikUlcinjSourceName = "Vodovod i kanalizacija Ulcinj";
const vikUlcinjPublicUrl = `${vikUlcinjOrigin}/`;
const vikUlcinjMunicipalityArea = "Opština Ulcinj";
const maximumResponseLength = 2_000_000;

// One bounded request per refresh. ViK Ulcinj publishes roughly eight announcements a month, so 20
// posts is about two and a half months of history — far beyond the window in which any notice can
// still be relevant (see undatedNoticeRelevanceDays), which means a refresh can never miss a new
// announcement and never needs to page. `_fields` keeps the payload to what is parsed; the archive
// is deliberately not crawled.
const vikUlcinjPostLimit = 20;
const vikUlcinjPostsUrl =
  `${vikUlcinjOrigin}/wp-json/wp/v2/posts` +
  `?per_page=${vikUlcinjPostLimit}&orderby=date&order=desc` +
  `&_fields=id,date,date_gmt,link,title,content`;

// How long an announcement that names no service date stays on the dashboard. This is a display
// relevance policy, NOT a claim about when the interruption started or ended: an emergency notice
// ("ekipe su na terenu", restoration expected "sjutra") is stale within a day or two, and leaving
// it marked active indefinitely would be worse than dropping it. Notices that DO name a service
// date expire from that date instead, never from this window.
const undatedNoticeRelevanceDays = 2;
const undatedNoticeMaximumAgeMs = undatedNoticeRelevanceDays * 86_400_000;

type VikUlcinjFreshnessStatus = "fresh" | "stale" | "unavailable";
type VikUlcinjProviderMode = "disabled" | "live";

interface VikUlcinjPost {
  content: string;
  publishedAt?: Date;
  sourceId: number;
  title: string;
  url: string;
}

interface VikUlcinjCacheSnapshot {
  alerts: CityAlert[];
  fetchedAt: string;
  freshnessStatus: VikUlcinjFreshnessStatus;
  lastRefreshError?: string;
  lastSuccessfulRefreshAt: string;
  parserWarnings: string[];
  schemaVersion: 1;
  source: typeof vikUlcinjSourceName;
  sourceUrl: string;
}

interface VikUlcinjHttpClient {
  get(url: string): Promise<string>;
}

interface VikUlcinjRefreshResult {
  errorCode?: string;
  retainedPreviousSnapshot: boolean;
  snapshot: VikUlcinjCacheSnapshot | null;
  success: boolean;
  warnings: string[];
}

interface VikUlcinjCollectorResult {
  exitCode: 0 | 1;
  summary: {
    alertCount: number;
    cachePath: string;
    cacheStatus: VikUlcinjFreshnessStatus;
    cityId: "ulcinj";
    completedAt: string;
    errorCode?: string;
    retainedPreviousSnapshot: boolean;
    status: "already-running" | "retained" | "success" | "unavailable";
    warnings: string[];
  };
}

class VikUlcinjError extends Error {
  readonly code:
    | "cache-read-failed"
    | "cache-write-failed"
    | "parser-unrecognized"
    | "posts-unavailable"
    | "vik-ulcinj-host-rejected";

  constructor(code: VikUlcinjError["code"], message: string) {
    super(message);
    this.name = "VikUlcinjError";
    this.code = code;
  }
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

function assertVikUlcinjUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !["vik-ulcinj.me", "www.vik-ulcinj.me"].includes(url.hostname))
      throw new Error();
  } catch {
    throw new VikUlcinjError("vik-ulcinj-host-rejected", "ViK Ulcinj URL host is not allowed.");
  }
}

function createVikUlcinjHttpClient({
  fetchImplementation = fetch,
  timeoutMs = 10_000,
}: {
  fetchImplementation?: FetchImplementation;
  timeoutMs?: number;
} = {}): VikUlcinjHttpClient {
  return {
    async get(requestedUrl) {
      assertVikUlcinjUrl(requestedUrl);
      try {
        const response = await fetchImplementation(requestedUrl, {
          headers: {
            Accept: "application/json",
            "User-Agent": "Gradom/0.1 (+https://gradom.me)",
          },
          signal: AbortSignal.timeout(timeoutMs),
        });
        assertVikUlcinjUrl(response.url ?? requestedUrl);
        if (!response.ok) {
          throw new VikUlcinjError(
            "posts-unavailable",
            "ViK Ulcinj did not return a successful response.",
          );
        }
        const contentType = response.headers?.get("content-type")?.toLowerCase() ?? "";
        if (contentType && !contentType.includes("application/json")) {
          throw new VikUlcinjError("parser-unrecognized", "ViK Ulcinj did not return JSON.");
        }
        const body = await response.text();
        if (!body.trim() || body.length > maximumResponseLength) {
          throw new VikUlcinjError("parser-unrecognized", "ViK Ulcinj response is unusable.");
        }
        return body;
      } catch (error) {
        if (error instanceof VikUlcinjError) throw error;
        throw new VikUlcinjError("posts-unavailable", "ViK Ulcinj request failed.");
      }
    },
  };
}

function parseVikUlcinjPosts(body: string): VikUlcinjPost[] {
  let value: unknown;
  try {
    value = JSON.parse(body);
  } catch {
    throw new VikUlcinjError("parser-unrecognized", "ViK Ulcinj posts payload is not JSON.");
  }
  if (!Array.isArray(value)) {
    throw new VikUlcinjError("parser-unrecognized", "ViK Ulcinj posts payload is not a list.");
  }
  return value.flatMap((entry) => {
    const post = toVikUlcinjPost(entry);
    return post ? [post] : [];
  });
}

function toVikUlcinjPost(value: unknown): VikUlcinjPost | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const sourceId = record.id;
  const link = record.link;
  if (typeof sourceId !== "number" || typeof link !== "string") return undefined;
  const url = toVikUlcinjUrl(link);
  const content = toLines(readRendered(record.content)).join("\n");
  const title = normalizeText(stripHtml(readRendered(record.title) ?? ""));
  if (!url || !content) return undefined;
  const publishedAt = parsePublishedAt(record.date_gmt);
  return { content, ...(publishedAt ? { publishedAt } : {}), sourceId, title, url };
}

function readRendered(value: unknown) {
  if (!value || typeof value !== "object") return undefined;
  const rendered = (value as Record<string, unknown>).rendered;
  return typeof rendered === "string" ? rendered : undefined;
}

// WordPress documents `date_gmt` as UTC, so it is read as the publication instant and never as a
// service time. Note the source's own timezone is misconfigured (the site reports gmt_offset 0 with
// no timezone_string, so `date` and `date_gmt` are identical strings) — the recorded instant can
// therefore be up to two hours away from the true one. That only affects how recently a notice was
// published, never when an interruption runs: those come from the article text alone.
function parsePublishedAt(value: unknown) {
  if (typeof value !== "string") return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/.exec(value.trim());
  if (!match) return undefined;
  const date = new Date(
    Date.UTC(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      Number(match[4]),
      Number(match[5]),
      Number(match[6] ?? "0"),
    ),
  );
  return Number.isNaN(date.getTime()) ? undefined : date;
}

// Conservative, evidence-based classification built from the announcements ViK Ulcinj actually
// publishes. An interruption must be stated outright: a supply-interruption word AND a water word
// have to both appear. That is what separates a real notice ("doći do prekida vodosnabdijevanja")
// from company news that merely discusses the water system — the July 2026 press release about
// illegal connections talks about "kvalitet i kontinuitet vodosnabdijevanja" at length but never
// announces an interruption, and must not become an alert. A drinking-water advisory is only
// recognised when no interruption was found, because outage notices routinely close with the same
// "da vodu ne koriste za piće" precaution and are outages first.
const interruptionPattern =
  /\b(?:prekid\w*|nestank\w*|nestanak\w*|obustav\w*|redukcij\w*|pad\w*\s+pritiska|bez\s+vode)\b/i;
const waterPattern = /\b(?:vod[aeiou]\w*|vodom|vodosnabd\w*|cijevovod\w*|cjevovod\w*)\b/i;
const drinkingWaterPattern =
  /\b(?:ne\s+koriste?\s+(?:vodu\s+)?za\s+piće|ne\s+preporučuje\s+za\s+piće|nije\s+za\s+piće|prokuva\w*|neispravn\w*\s+vod\w*|kvalitet\w*\s+vode|parametr\w*(?:\s+\w+)?\s+vode)\b/i;

function classifyVikUlcinjNotice(value: string): CityAlert["type"] | undefined {
  if (interruptionPattern.test(value) && waterPattern.test(value)) return "waterOutage";
  return drinkingWaterPattern.test(value) ? "drinkingWaterNotice" : undefined;
}

// Only an explicitly written calendar date counts as the service date. The publication timestamp is
// never promoted into one: ViK Ulcinj routinely publishes the evening before the works ("11.07 at
// 23:28" announcing an interruption "dana 12.07.2026"), so anchoring to publication would move the
// interruption to the wrong day. A notice with no written date simply has no service date.
// The year ends with a digit lookahead rather than \b: ViK Ulcinj writes "dana 12.07.2026god."
// with no space before the abbreviation, where a word boundary never matches.
function parseServiceDate(value: string) {
  const match = /(?<!\d)(\d{1,2})\s*[.]\s*(\d{1,2})\s*[.]\s*(\d{4})(?!\d)/.exec(value);
  if (!match) return undefined;
  const [year, month, day] = [Number(match[3]), Number(match[2]) - 1, Number(match[1])];
  const date = new Date(Date.UTC(year, month, day, 12));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month && date.getUTCDate() === day
    ? date
    : undefined;
}

// Ranges are written inconsistently ("od 07.00-14:00h", "od 08:00-12:00h časova", "od 10:30 do
// 12:00"), so both separators are accepted. A start with a prose ending ("od 07:00 časova do kasnih
// popodnevnih sati") yields a start and NO end — the end genuinely is not stated, and inventing one
// would be worse than leaving the UI without it.
function parseServiceTimes(value: string) {
  const range = /\bod\s*(\d{1,2}[.:]\d{2})\s*(?:-|–|—|do)\s*(\d{1,2}[.:]\d{2})/i.exec(value);
  if (range) return { end: parseTime(range[2]), start: parseTime(range[1]) };
  const start = /\bod\s*(\d{1,2}[.:]\d{2})/i.exec(value);
  return { end: undefined, start: start ? parseTime(start[1]) : undefined };
}

function parseTime(value: string) {
  const [hourValue, minuteValue] = value.split(/[.:]/);
  const hour = Number(hourValue);
  const minute = Number(minuteValue);
  return Number.isInteger(hour) && Number.isInteger(minute) && hour <= 23 && minute <= 59
    ? { hour, minute }
    : undefined;
}

// Affected places are taken only where ViK Ulcinj lists them itself: the pinned bullets ("📍Gač")
// or the lines under an explicit "…u sljedećim naseljima:" / "Zone koje neće imati
// vodosnabdijevanje su:" heading. Wording is preserved exactly as published — no gazetteer, no
// geocoding, no guessing at neighbourhoods from prose. When nothing is listed the notice is
// attributed to the municipality rather than to an invented area.
const locationHeadingPattern =
  /(?:u\s+sljedećim\s+naseljima|zone\s+koje\s+ne[čć]e\s+imati\s+vodosnabdijevanje\s+su|naseljima)\s*:\s*$/i;
const locationBulletPattern = /^\s*(?:📍|–|—|-|•|\*)\s*/u;
const prosePattern = /\b(?:hvala|molimo|preporučujemo|doo|shpk|obavještavaju|ekipe|vodovod)\b/i;

function extractAffectedLocations(lines: readonly string[]) {
  const bulleted = lines.filter((line) => line.trimStart().startsWith("📍"));
  const listed = bulleted.length > 0 ? bulleted : collectLinesUnderHeading(lines);
  const locations = listed
    .map((line) => normalizeText(line.replace(locationBulletPattern, "")))
    .filter((line) => line.length > 0 && line.length <= 80);
  return deduplicateLocations(locations);
}

function collectLinesUnderHeading(lines: readonly string[]) {
  const headingIndex = lines.findIndex((line) => locationHeadingPattern.test(line.trim()));
  if (headingIndex < 0) return [];
  const collected: string[] = [];
  for (const line of lines.slice(headingIndex + 1)) {
    const value = line.trim();
    if (!value) continue;
    if (value.length > 80 || prosePattern.test(value)) break;
    collected.push(value);
  }
  return collected;
}

// Case- and diacritic-insensitive only: two spellings of the same place collapse, but genuinely
// different places never do, and the first published spelling is what gets displayed.
function deduplicateLocations(locations: readonly string[]) {
  const seen = new Map<string, string>();
  for (const location of locations) {
    const key = location
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLocaleLowerCase("en");
    if (!seen.has(key)) seen.set(key, location);
  }
  return [...seen.values()];
}

function parseVikUlcinjNotice(post: VikUlcinjPost, now = new Date()) {
  const lines = post.content.split("\n");
  const text = `${post.title} ${lines.join(" ")}`;
  const type = classifyVikUlcinjNotice(text);
  if (!type) return { alerts: [], warnings: ["notice-not-water-service-related"] };

  const serviceDate = parseServiceDate(text);
  const { end, start } = parseServiceTimes(text);
  const startsAt = serviceDate && start ? withPodgoricaTime(serviceDate, start) : undefined;
  const expectedEndAt = serviceDate && end ? withPodgoricaTime(serviceDate, end) : undefined;
  const locations = extractAffectedLocations(lines);
  const area = locations.length > 0 ? locations.join(", ") : vikUlcinjMunicipalityArea;
  const description = normalizeText(lines.join(" "));
  const id = createHash("sha256")
    .update(`${post.url}|${type}|${area}|${startsAt?.toISOString() ?? ""}`)
    .digest("hex");

  return {
    alerts: [
      {
        affectedArea: { kind: "source" as const, value: area },
        cityIds: ["ulcinj" as const],
        dataMode: "live" as const,
        description: { kind: "source" as const, value: description },
        ...(expectedEndAt ? { expectedEndAt } : {}),
        id,
        ...(post.publishedAt ? { publishedAt: post.publishedAt } : {}),
        rawSourceText: description,
        severity: type === "waterOutage" ? ("warning" as const) : ("information" as const),
        source: { kind: "source" as const, value: vikUlcinjSourceName },
        sourceUrl: post.url,
        ...(startsAt ? { startsAt } : {}),
        status: getVikUlcinjAlertStatus({
          expectedEndAt,
          now,
          publishedAt: post.publishedAt,
          serviceDate,
          startsAt,
        }),
        title: { kind: "source" as const, value: post.title || vikUlcinjSourceName },
        type,
      } satisfies CityAlert,
    ],
    warnings: [],
  };
}

// Expiry is decided by the strongest fact available, in order: a stated end time, a stated service
// date (the notice stops applying once that day is over in Podgorica), and only otherwise the
// publication-recency window. The fallback never claims to be the outage's timing — it just stops
// an undated notice from sitting on the dashboard forever.
function getVikUlcinjAlertStatus({
  expectedEndAt,
  now,
  publishedAt,
  serviceDate,
  startsAt,
}: {
  expectedEndAt?: Date;
  now: Date;
  publishedAt?: Date;
  serviceDate?: Date;
  startsAt?: Date;
}) {
  // "Has it finished?" then "has it started?" — in that order. Checking the end first and returning
  // active would mark tomorrow's announced interruption as already under way.
  if (expectedEndAt && expectedEndAt <= now) return "expired" as const;
  if (startsAt && startsAt > now) return "scheduled" as const;
  if (expectedEndAt) return "active" as const;
  if (serviceDate) {
    return isPodgoricaDayOver(serviceDate, now) ? ("expired" as const) : ("active" as const);
  }
  if (publishedAt && now.getTime() - publishedAt.getTime() > undatedNoticeMaximumAgeMs) {
    return "expired" as const;
  }
  return "active" as const;
}

function isPodgoricaDayOver(day: Date, now: Date) {
  return getPodgoricaDay(now) > getPodgoricaDay(day);
}

function getPodgoricaDay(value: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Europe/Podgorica",
    year: "numeric",
  }).format(value);
}

function withPodgoricaTime(date: Date, time: { hour: number; minute: number }) {
  const utc = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    time.hour,
    time.minute,
  );
  const offset = new Intl.DateTimeFormat("en", {
    timeZone: "Europe/Podgorica",
    timeZoneName: "longOffset",
  })
    .formatToParts(new Date(utc))
    .find((part) => part.type === "timeZoneName")?.value;
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(offset ?? "");
  const milliseconds = match
    ? (Number(match[2]) * 60 + Number(match[3])) * 60_000 * (match[1] === "+" ? 1 : -1)
    : 0;
  return new Date(utc - milliseconds);
}

function toVikUlcinjUrl(value: string) {
  try {
    const url = new URL(value, vikUlcinjOrigin);
    assertVikUlcinjUrl(url.toString());
    return url.toString();
  } catch {
    return undefined;
  }
}

function toLines(html: string | undefined) {
  if (!html) return [];
  return stripHtml(html.replace(/<(?:br|\/p|\/li|\/div|\/h[1-6])\s*\/?>/gi, "\n"))
    .split("\n")
    .map((line) => normalizeText(line))
    .filter((line) => line.length > 0);
}

function stripHtml(value: string) {
  return value
    .replace(/<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ");
}

function normalizeText(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&#8211;/gi, "–")
    .replace(/&#8212;/gi, "—")
    .replace(/&#821[67];/gi, "'")
    .replace(/&#822[01];/gi, '"')
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&")
    .replace(/[^\S\n]+/g, " ")
    .trim();
}

function calculateVikUlcinjFreshness(fetchedAt: Date | undefined, now = new Date()) {
  return calculateCacheFreshness(fetchedAt, now, env.VIK_ULCINJ_CACHE_FRESHNESS_MINUTES);
}

async function readVikUlcinjCache(
  cachePath = env.VIK_ULCINJ_CACHE_PATH,
  fileSystem: CacheFileSystem = nodeFileSystem,
): Promise<VikUlcinjCacheSnapshot | null> {
  try {
    const value = JSON.parse(await fileSystem.readFile(cachePath, "utf8")) as unknown;
    if (!isVikUlcinjCacheSnapshot(value)) return null;
    const alerts = deserializeCityAlerts(value.alerts);
    if (!alerts) return null;
    return {
      ...value,
      alerts,
      freshnessStatus: calculateVikUlcinjFreshness(new Date(value.fetchedAt)),
    };
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT")
      return null;
    throw new VikUlcinjError("cache-read-failed", "ViK Ulcinj cache could not be read.");
  }
}

function isVikUlcinjCacheSnapshot(value: unknown): value is VikUlcinjCacheSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Record<string, unknown>;
  return (
    snapshot.schemaVersion === 1 &&
    snapshot.source === vikUlcinjSourceName &&
    typeof snapshot.fetchedAt === "string" &&
    typeof snapshot.lastSuccessfulRefreshAt === "string" &&
    typeof snapshot.sourceUrl === "string" &&
    Array.isArray(snapshot.parserWarnings) &&
    snapshot.parserWarnings.every((warning) => typeof warning === "string") &&
    deserializeCityAlerts(snapshot.alerts)?.every((alert) => alert.cityIds.includes("ulcinj")) ===
      true
  );
}

async function writeVikUlcinjCache(
  snapshot: VikUlcinjCacheSnapshot,
  cachePath = env.VIK_ULCINJ_CACHE_PATH,
  fileSystem: CacheFileSystem = nodeFileSystem,
) {
  try {
    await writeJsonCache(snapshot, cachePath, fileSystem);
  } catch {
    throw new VikUlcinjError("cache-write-failed", "ViK Ulcinj cache could not be updated.");
  }
}

async function refreshVikUlcinj({
  cache,
  httpClient,
  now = () => new Date(),
}: {
  cache: {
    read(): Promise<VikUlcinjCacheSnapshot | null>;
    write(snapshot: VikUlcinjCacheSnapshot): Promise<void>;
  };
  httpClient: VikUlcinjHttpClient;
  now?: () => Date;
}): Promise<VikUlcinjRefreshResult> {
  let previous: VikUlcinjCacheSnapshot | null;
  try {
    previous = await cache.read();
  } catch (error) {
    return retainVikUlcinjSnapshot(null, errorCode(error), []);
  }
  try {
    const posts = parseVikUlcinjPosts(await httpClient.get(vikUlcinjPostsUrl));
    // An empty list is a real answer ("nothing published"), but it is indistinguishable from a
    // silently reshaped payload, so the previous snapshot is kept rather than blanking the city.
    if (posts.length === 0) {
      return retainVikUlcinjSnapshot(previous, "parser-unrecognized", ["zero-posts-recognized"]);
    }
    const parsed = posts.map((post) => parseVikUlcinjNotice(post, now()));
    const alerts = deduplicateAlerts(parsed.flatMap((result) => result.alerts));
    const warnings = parsed.flatMap((result) => result.warnings);
    const timestamp = now().toISOString();
    // Unlike a listing scrape, "no water-service announcements right now" is a legitimate and
    // common outcome here: most ViK Ulcinj posts are ordinary news. A successful fetch with zero
    // matching notices is therefore a successful refresh with an empty alert list, which is what
    // lets the UI say "no current interruption" instead of "unavailable".
    const snapshot: VikUlcinjCacheSnapshot = {
      alerts,
      fetchedAt: timestamp,
      freshnessStatus: "fresh",
      lastSuccessfulRefreshAt: timestamp,
      parserWarnings: warnings,
      schemaVersion: 1,
      source: vikUlcinjSourceName,
      sourceUrl: vikUlcinjPublicUrl,
    };
    try {
      await cache.write(snapshot);
    } catch {
      return {
        errorCode: "cache-write-failed",
        retainedPreviousSnapshot: false,
        snapshot: null,
        success: false,
        warnings,
      };
    }
    return { retainedPreviousSnapshot: false, snapshot, success: true, warnings };
  } catch (error) {
    return retainVikUlcinjSnapshot(previous, errorCode(error), []);
  }
}

function retainVikUlcinjSnapshot(
  previous: VikUlcinjCacheSnapshot | null,
  errorCode: string,
  warnings: string[],
): VikUlcinjRefreshResult {
  return {
    errorCode,
    retainedPreviousSnapshot: Boolean(previous),
    snapshot: previous
      ? { ...previous, freshnessStatus: "stale", lastRefreshError: errorCode }
      : null,
    success: false,
    warnings,
  };
}

function errorCode(error: unknown) {
  return error instanceof VikUlcinjError ? error.code : "vik-ulcinj-refresh-failed";
}

function deduplicateAlerts(alerts: readonly CityAlert[]) {
  return [...new Map(alerts.map((alert) => [alert.id, alert])).values()];
}

async function runVikUlcinjCollector({
  cachePath = env.VIK_ULCINJ_CACHE_PATH,
  refresh,
  writeOutput = console.log,
}: {
  cachePath?: string;
  refresh?: () => Promise<VikUlcinjRefreshResult>;
  writeOutput?: (line: string) => void;
} = {}): Promise<VikUlcinjCollectorResult> {
  const lock = await acquireRefreshLock(dirname(cachePath), {
    lockFileName: ".vik-ulcinj-refresh.lock",
  });
  if (!("release" in lock)) {
    const summary = {
      alertCount: 0,
      cachePath,
      cacheStatus: "unavailable" as const,
      cityId: "ulcinj" as const,
      completedAt: new Date().toISOString(),
      retainedPreviousSnapshot: false,
      status: "already-running" as const,
      warnings: [],
    };
    writeOutput(JSON.stringify({ provider: "vik-ulcinj", ...summary }));
    return { exitCode: 0, summary };
  }
  try {
    const result = await (
      refresh ??
      (() =>
        refreshVikUlcinj({
          cache: {
            read: () => readVikUlcinjCache(cachePath),
            write: (snapshot) => writeVikUlcinjCache(snapshot, cachePath),
          },
          httpClient: createVikUlcinjHttpClient(),
        }))
    )();
    const summary = {
      alertCount: result.snapshot?.alerts.length ?? 0,
      cachePath,
      cacheStatus: result.snapshot?.freshnessStatus ?? ("unavailable" as VikUlcinjFreshnessStatus),
      cityId: "ulcinj" as const,
      completedAt: new Date().toISOString(),
      ...(result.errorCode ? { errorCode: result.errorCode } : {}),
      retainedPreviousSnapshot: result.retainedPreviousSnapshot,
      status: result.success
        ? ("success" as const)
        : result.retainedPreviousSnapshot
          ? ("retained" as const)
          : ("unavailable" as const),
      warnings: result.warnings,
    };
    writeOutput(JSON.stringify({ provider: "vik-ulcinj", ...summary }));
    return { exitCode: result.success || result.retainedPreviousSnapshot ? 0 : 1, summary };
  } finally {
    await lock.release();
  }
}

async function getVikUlcinjCityAlerts({
  context,
  mode,
  now = () => new Date(),
  readCache = readVikUlcinjCache,
}: {
  context: CityContext;
  mode: VikUlcinjProviderMode;
  now?: () => Date;
  readCache?: () => Promise<VikUlcinjCacheSnapshot | null>;
}) {
  if (
    mode === "disabled" ||
    !isCitySupportedByProvider(context.city, vikUlcinjProviderMetadata.supportedCityIds)
  ) {
    return {
      alerts: [],
      freshnessStatus: "unavailable" as const,
      mode: "disabled" as const,
      providerId: "vik-ulcinj" as const,
    };
  }
  try {
    const cache = await readCache();
    if (!cache) {
      return {
        alerts: [],
        freshnessStatus: "unavailable" as const,
        mode,
        providerId: "vik-ulcinj" as const,
      };
    }
    return {
      // Re-evaluated on read as well as on collection, so a notice that expires between refreshes
      // disappears at the right moment rather than at the next collector run.
      alerts: cache.alerts
        .map((alert) => refreshVikUlcinjAlertStatus(alert, now()))
        .filter((alert) => alert.status !== "expired"),
      freshnessStatus: cache.freshnessStatus,
      lastSuccessfulUpdate: new Date(cache.lastSuccessfulRefreshAt),
      mode,
      providerId: "vik-ulcinj" as const,
    };
  } catch {
    return {
      alerts: [],
      freshnessStatus: "unavailable" as const,
      mode,
      providerId: "vik-ulcinj" as const,
    };
  }
}

// A safety net for the gap between collector runs, not a second source of truth. It can only ever
// retire an alert: an alert the collector already expired stays expired, because the collector
// decided that from the article's own service date, which a cached alert no longer carries.
function refreshVikUlcinjAlertStatus(alert: CityAlert, now: Date) {
  if (alert.status === "expired") return alert;
  const status = getVikUlcinjAlertStatus({
    expectedEndAt: alert.expectedEndAt,
    now,
    publishedAt: alert.publishedAt,
    ...(alert.startsAt ? { serviceDate: alert.startsAt } : {}),
    startsAt: alert.startsAt,
  });
  return status === alert.status ? alert : { ...alert, status };
}

const vikUlcinjProviderMetadata: ProviderMetadata = {
  cachePath: env.VIK_ULCINJ_CACHE_PATH,
  displayName: "Vodovod i kanalizacija Ulcinj water notices",
  enabled: true,
  id: "vik-ulcinj",
  officialSource: vikUlcinjPublicUrl,
  refreshIntervalMinutes: 120,
  supportedCityIds: ["ulcinj"],
  supportsMultipleCities: false,
};

export {
  assertVikUlcinjUrl,
  classifyVikUlcinjNotice,
  createVikUlcinjHttpClient,
  extractAffectedLocations,
  getVikUlcinjCityAlerts,
  parseVikUlcinjNotice,
  parseVikUlcinjPosts,
  readVikUlcinjCache,
  refreshVikUlcinj,
  runVikUlcinjCollector,
  vikUlcinjPostsUrl,
  vikUlcinjProviderMetadata,
  writeVikUlcinjCache,
  VikUlcinjError,
  type VikUlcinjCacheSnapshot,
  type VikUlcinjCollectorResult,
  type VikUlcinjFreshnessStatus,
  type VikUlcinjHttpClient,
  type VikUlcinjPost,
  type VikUlcinjRefreshResult,
};
