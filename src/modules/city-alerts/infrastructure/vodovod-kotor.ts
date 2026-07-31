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

const vodovodKotorOrigin = "https://vodovodkotor.com";
const vodovodKotorServiceInformationUrl = `${vodovodKotorOrigin}/servisne-informacije/`;
const maximumResponseLength = 1_000_000;

type VodovodKotorFreshnessStatus = "fresh" | "stale" | "unavailable";
type VodovodKotorProviderMode = "disabled" | "live";

interface VodovodKotorNoticeLink {
  publishedAt?: Date;
  title: string;
  url: string;
}

interface VodovodKotorCacheSnapshot {
  alerts: CityAlert[];
  fetchedAt: string;
  freshnessStatus: VodovodKotorFreshnessStatus;
  lastRefreshError?: string;
  lastSuccessfulRefreshAt: string;
  parserWarnings: string[];
  schemaVersion: 1;
  source: "Vodovod i kanalizacija Kotor";
  sourceUrl: string;
}

interface VodovodKotorHttpClient {
  get(url: string): Promise<string>;
}

interface VodovodKotorRefreshResult {
  errorCode?: string;
  retainedPreviousSnapshot: boolean;
  snapshot: VodovodKotorCacheSnapshot | null;
  success: boolean;
  warnings: string[];
}

interface VodovodKotorCollectorResult {
  exitCode: 0 | 1;
  summary: {
    alertCount: number;
    cachePath: string;
    cacheStatus: VodovodKotorFreshnessStatus;
    cityId: "kotor";
    completedAt: string;
    errorCode?: string;
    retainedPreviousSnapshot: boolean;
    status: "already-running" | "retained" | "success" | "unavailable";
    warnings: string[];
  };
}

class VodovodKotorError extends Error {
  readonly code:
    | "cache-read-failed"
    | "cache-write-failed"
    | "detail-page-unavailable"
    | "listing-unavailable"
    | "parser-unrecognized"
    | "vodovod-kotor-host-rejected";

  constructor(code: VodovodKotorError["code"], message: string) {
    super(message);
    this.name = "VodovodKotorError";
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

function assertVodovodKotorUrl(value: string) {
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      !["vodovodkotor.com", "www.vodovodkotor.com"].includes(url.hostname)
    ) {
      throw new Error();
    }
  } catch {
    throw new VodovodKotorError(
      "vodovod-kotor-host-rejected",
      "Vodovod Kotor URL host is not allowed.",
    );
  }
}

function createVodovodKotorHttpClient({
  fetchImplementation = fetch,
  timeoutMs = 10_000,
}: {
  fetchImplementation?: FetchImplementation;
  timeoutMs?: number;
} = {}): VodovodKotorHttpClient {
  return {
    async get(requestedUrl) {
      assertVodovodKotorUrl(requestedUrl);
      try {
        const response = await fetchImplementation(requestedUrl, {
          headers: {
            Accept: "text/html,application/xhtml+xml",
            "User-Agent": "Gradom/0.1 (+https://gradom.me)",
          },
          signal: AbortSignal.timeout(timeoutMs),
        });
        assertVodovodKotorUrl(response.url ?? requestedUrl);
        if (!response.ok) {
          throw new VodovodKotorError(
            requestedUrl === vodovodKotorServiceInformationUrl
              ? "listing-unavailable"
              : "detail-page-unavailable",
            "Vodovod Kotor did not return a successful response.",
          );
        }
        const contentType = response.headers?.get("content-type")?.toLowerCase() ?? "";
        if (contentType && !contentType.includes("text/html")) {
          throw new VodovodKotorError("parser-unrecognized", "Vodovod Kotor did not return HTML.");
        }
        const body = await response.text();
        if (!body.trim() || body.length > maximumResponseLength) {
          throw new VodovodKotorError("parser-unrecognized", "Vodovod Kotor response is unusable.");
        }
        return body;
      } catch (error) {
        if (error instanceof VodovodKotorError) throw error;
        throw new VodovodKotorError(
          requestedUrl === vodovodKotorServiceInformationUrl
            ? "listing-unavailable"
            : "detail-page-unavailable",
          "Vodovod Kotor request failed.",
        );
      }
    },
  };
}

function discoverVodovodKotorNotices(html: string, now = new Date()): VodovodKotorNoticeLink[] {
  const articleWindows = [...html.matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/gi)].map(
    (match) => match[1],
  );
  const windows = articleWindows.length > 0 ? articleWindows : [html];
  const notices = windows.flatMap((window) => {
    const link =
      /<a\b[^>]*href=["']([^"']*\/servisne-informacije\/\d+\/?)["'][^>]*>([\s\S]*?)<\/a>/i.exec(
        window,
      );
    if (!link) return [];
    const url = toVodovodKotorUrl(link[1]);
    const title = normalizeText(stripHtml(link[2]));
    if (!url || !title) return [];
    const publishedAt = parseDate(stripHtml(window), now.getUTCFullYear());
    return [{ ...(publishedAt ? { publishedAt } : {}), title, url }];
  });
  return [...new Map(notices.map((notice) => [notice.url, notice])).values()];
}

function parseVodovodKotorNotice(notice: VodovodKotorNoticeLink, html: string, now = new Date()) {
  const content = extractVodovodKotorContent(html);
  const title = extractHeading(html) ?? notice.title;
  const publishedAt = notice.publishedAt ?? parseDate(`${title} ${content}`, now.getUTCFullYear());
  if (!content)
    return { alerts: [], contentRecognized: false, warnings: ["article-content-unrecognized"] };

  const type = getVodovodKotorAlertType(`${title} ${content}`);
  if (!type)
    return { alerts: [], contentRecognized: true, warnings: ["notice-not-water-service-related"] };

  const rows = type === "waterTankerSchedule" ? parseTankerRows(html) : [];
  const alerts =
    rows.length > 0
      ? rows.map(({ area, endTime, startTime }) =>
          createVodovodKotorAlert({
            area,
            content,
            endTime,
            notice,
            publishedAt,
            startTime,
            title,
            type,
            now,
          }),
        )
      : (() => {
          const area = extractAffectedArea(content);
          return area
            ? [createVodovodKotorAlert({ area, content, notice, publishedAt, title, type, now })]
            : [];
        })();
  return {
    alerts,
    contentRecognized: true,
    warnings: alerts.length > 0 ? [] : ["affected-area-unrecognized"],
  };
}

function createVodovodKotorAlert({
  area,
  content,
  endTime,
  notice,
  now,
  publishedAt,
  startTime,
  title,
  type,
}: {
  area: string;
  content: string;
  endTime?: { hour: number; minute: number };
  notice: VodovodKotorNoticeLink;
  now: Date;
  publishedAt?: Date;
  startTime?: { hour: number; minute: number };
  title: string;
  type: CityAlert["type"];
}) {
  const startsAt = publishedAt && startTime ? withPodgoricaTime(publishedAt, startTime) : undefined;
  const expectedEndAt =
    publishedAt && endTime ? withPodgoricaTime(publishedAt, endTime) : undefined;
  const id = createHash("sha256")
    .update(`${notice.url}|${type}|${area}|${startsAt?.toISOString() ?? ""}`)
    .digest("hex");
  return {
    affectedArea: { kind: "source" as const, value: area },
    cityIds: ["kotor"],
    dataMode: "live" as const,
    description: { kind: "source" as const, value: content },
    ...(expectedEndAt ? { expectedEndAt } : {}),
    id,
    ...(publishedAt ? { publishedAt } : {}),
    rawSourceText: content,
    severity: type === "waterOutage" ? ("warning" as const) : ("information" as const),
    source: { kind: "source" as const, value: "Vodovod i kanalizacija Kotor" },
    sourceUrl: notice.url,
    ...(startsAt ? { startsAt } : {}),
    status: getAlertStatus({ expectedEndAt, now, publishedAt, startsAt, type }),
    title: { kind: "source" as const, value: title },
    type,
  } satisfies CityAlert;
}

function getVodovodKotorAlertType(value: string): CityAlert["type"] | undefined {
  if (/\bcistern\w*/i.test(value)) return "waterTankerSchedule";
  if (/\b(?:ispravnost|kvalitet|zdravstven\w*|prokuvavanje|pitk\w*\s+vod\w*)\b/i.test(value)) {
    return "drinkingWaterNotice";
  }
  return /\b(?:obustav\w*|prekid\w*|kvar\w*|havarij\w*|radov\w*|vodosnabdijevanj\w*|smanjen\w*\s+pritisak)\b/i.test(
    value,
  )
    ? "waterOutage"
    : undefined;
}

function parseTankerRows(html: string) {
  return [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].flatMap((match) => {
    const cells = [...match[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) =>
      normalizeText(stripHtml(cell[1])),
    );
    if (cells.length < 2 || /vrijeme|lokacija/i.test(cells.join(" "))) return [];
    const [startTime, endTime] = parseTimeRange(cells[0]);
    return cells[1] && (startTime || endTime)
      ? [{ area: cells[1], ...(startTime ? { startTime } : {}), ...(endTime ? { endTime } : {}) }]
      : [];
  });
}

function extractVodovodKotorContent(html: string) {
  const main = /<main\b[^>]*>([\s\S]*?)<\/main>/i.exec(html)?.[1] ?? html;
  const afterHeading = /<h1\b[^>]*>[\s\S]*?<\/h1>([\s\S]*)/i.exec(main)?.[1] ?? main;
  return normalizeText(stripHtml(afterHeading).replace(/\b(?:Kontakt|Copyright)\b[\s\S]*$/i, ""));
}

function extractHeading(html: string) {
  const heading = /<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(html)?.[1];
  return heading ? normalizeText(stripHtml(heading)) : undefined;
}

function extractAffectedArea(value: string) {
  const patterns = [
    /\b(?:u|na)\s+(?:području|naselju|mjestu|dijelu)\s+([^,.]+?)(?=[,.]|\s+(?:da|će|je|su|zbog|radi)\b|$)/i,
    /\b(?:potrošač\w*|stanovnik\w*)\s+(?:u|na)\s+([^,.]+?)(?=[,.]|\s+(?:da|će|je|su|zbog|radi)\b|$)/i,
  ];
  const match = patterns.map((pattern) => pattern.exec(value)?.[1]).find(Boolean);
  return match ? normalizeText(match) : undefined;
}

function parseTimeRange(value: string) {
  const match = /(\d{1,2}(?::\d{2})?)\s*(?:-|–|do)\s*(\d{1,2}(?::\d{2})?)/.exec(value);
  return [
    match ? parseTime(match[1]) : undefined,
    match ? parseTime(match[2]) : undefined,
  ] as const;
}

function parseTime(value: string) {
  const [hourValue, minuteValue = "0"] = value.split(":");
  const hour = Number(hourValue);
  const minute = Number(minuteValue);
  return Number.isInteger(hour) && Number.isInteger(minute) && hour <= 23 && minute <= 59
    ? { hour, minute }
    : undefined;
}

function getAlertStatus({
  expectedEndAt,
  now,
  publishedAt,
  startsAt,
  type,
}: {
  expectedEndAt?: Date;
  now: Date;
  publishedAt?: Date;
  startsAt?: Date;
  type: CityAlert["type"];
}) {
  if (expectedEndAt && expectedEndAt <= now) return "expired" as const;
  if (startsAt && startsAt > now) return "scheduled" as const;
  if (type === "waterTankerSchedule" && publishedAt && !isSamePodgoricaDay(publishedAt, now)) {
    return "expired" as const;
  }
  return "active" as const;
}

function parseDate(value: string, defaultYear: number) {
  const numeric = /\b(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})\b/.exec(value);
  if (numeric)
    return toValidDate(
      Number(numeric[3].length === 2 ? `20${numeric[3]}` : numeric[3]),
      Number(numeric[2]) - 1,
      Number(numeric[1]),
    );
  const named =
    /\b(\d{1,2})\.?\s+(januar(?:a)?|februar(?:a)?|mart(?:a)?|april(?:a)?|maj(?:a)?|jun(?:a)?|jul(?:a)?|avgust(?:a)?|septembar(?:a)?|oktobar(?:a)?|novembar(?:a)?|decembar(?:a)?)(?:\s+(\d{4}))?\b/i.exec(
      value,
    );
  if (!named) return undefined;
  const month = [
    "januar",
    "februar",
    "mart",
    "april",
    "maj",
    "jun",
    "jul",
    "avgust",
    "septembar",
    "oktobar",
    "novembar",
    "decembar",
  ].findIndex((monthName) => named[2].toLowerCase().startsWith(monthName));
  return month >= 0
    ? toValidDate(Number(named[3] ?? defaultYear), month, Number(named[1]))
    : undefined;
}

function toValidDate(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month, day, 12));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month && date.getUTCDate() === day
    ? date
    : undefined;
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

function isSamePodgoricaDay(left: Date, right: Date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Europe/Podgorica",
    year: "numeric",
  });
  return formatter.format(left) === formatter.format(right);
}

function toVodovodKotorUrl(value: string) {
  try {
    const url = new URL(value, vodovodKotorOrigin);
    assertVodovodKotorUrl(url.toString());
    return url.toString();
  } catch {
    return undefined;
  }
}

function stripHtml(value: string) {
  return value
    .replace(/<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ");
}

function normalizeText(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function calculateVodovodKotorFreshness(fetchedAt: Date | undefined, now = new Date()) {
  return calculateCacheFreshness(fetchedAt, now, env.VODOVOD_KOTOR_CACHE_FRESHNESS_MINUTES);
}

async function readVodovodKotorCache(
  cachePath = env.VODOVOD_KOTOR_CACHE_PATH,
  fileSystem: CacheFileSystem = nodeFileSystem,
): Promise<VodovodKotorCacheSnapshot | null> {
  try {
    const value = JSON.parse(await fileSystem.readFile(cachePath, "utf8")) as unknown;
    if (!isVodovodKotorCacheSnapshot(value)) return null;
    return { ...value, freshnessStatus: calculateVodovodKotorFreshness(new Date(value.fetchedAt)) };
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT")
      return null;
    throw new VodovodKotorError("cache-read-failed", "Vodovod Kotor cache could not be read.");
  }
}

function isVodovodKotorCacheSnapshot(value: unknown): value is VodovodKotorCacheSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Record<string, unknown>;
  return (
    snapshot.schemaVersion === 1 &&
    snapshot.source === "Vodovod i kanalizacija Kotor" &&
    typeof snapshot.fetchedAt === "string" &&
    typeof snapshot.lastSuccessfulRefreshAt === "string" &&
    typeof snapshot.sourceUrl === "string" &&
    Array.isArray(snapshot.parserWarnings) &&
    snapshot.parserWarnings.every((warning) => typeof warning === "string") &&
    deserializeCityAlerts(snapshot.alerts)?.every((alert) => alert.cityIds.includes("kotor")) ===
      true
  );
}

async function writeVodovodKotorCache(
  snapshot: VodovodKotorCacheSnapshot,
  cachePath = env.VODOVOD_KOTOR_CACHE_PATH,
  fileSystem: CacheFileSystem = nodeFileSystem,
) {
  try {
    await writeJsonCache(snapshot, cachePath, fileSystem);
  } catch {
    throw new VodovodKotorError("cache-write-failed", "Vodovod Kotor cache could not be updated.");
  }
}

async function refreshVodovodKotor({
  cache,
  httpClient,
  now = () => new Date(),
}: {
  cache: {
    read(): Promise<VodovodKotorCacheSnapshot | null>;
    write(snapshot: VodovodKotorCacheSnapshot): Promise<void>;
  };
  httpClient: VodovodKotorHttpClient;
  now?: () => Date;
}): Promise<VodovodKotorRefreshResult> {
  let previous: VodovodKotorCacheSnapshot | null;
  try {
    previous = await cache.read();
  } catch (error) {
    return retainVodovodKotorSnapshot(null, errorCode(error), []);
  }
  try {
    const listing = await httpClient.get(vodovodKotorServiceInformationUrl);
    const notices = discoverVodovodKotorNotices(listing, now()).slice(0, 12);
    if (notices.length === 0 && !/servisne\s+informacije/i.test(listing)) {
      return retainVodovodKotorSnapshot(previous, "parser-unrecognized", [
        "listing-content-unrecognized",
      ]);
    }
    const outcomes = await Promise.all(
      notices.map(async (notice) => {
        try {
          return parseVodovodKotorNotice(notice, await httpClient.get(notice.url), now());
        } catch (error) {
          return { error };
        }
      }),
    );
    const parsed = outcomes.filter(
      (outcome): outcome is ReturnType<typeof parseVodovodKotorNotice> => "alerts" in outcome,
    );
    if (notices.length > 0 && parsed.length === 0) {
      return retainVodovodKotorSnapshot(previous, "detail-page-unavailable", [
        "all-detail-pages-unavailable",
      ]);
    }
    const alerts = deduplicateAlerts(parsed.flatMap((result) => result.alerts));
    const warnings = parsed.flatMap((result) => result.warnings);
    if (notices.length > 0 && alerts.length === 0) {
      return retainVodovodKotorSnapshot(previous, "parser-unrecognized", [
        "zero-valid-records",
        ...warnings,
      ]);
    }
    const timestamp = now().toISOString();
    const snapshot: VodovodKotorCacheSnapshot = {
      alerts,
      fetchedAt: timestamp,
      freshnessStatus: "fresh",
      lastSuccessfulRefreshAt: timestamp,
      parserWarnings: warnings,
      schemaVersion: 1,
      source: "Vodovod i kanalizacija Kotor",
      sourceUrl: vodovodKotorServiceInformationUrl,
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
    return retainVodovodKotorSnapshot(previous, errorCode(error), []);
  }
}

function retainVodovodKotorSnapshot(
  previous: VodovodKotorCacheSnapshot | null,
  errorCode: string,
  warnings: string[],
): VodovodKotorRefreshResult {
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
  return error instanceof VodovodKotorError ? error.code : "vodovod-kotor-refresh-failed";
}

function deduplicateAlerts(alerts: readonly CityAlert[]) {
  return [...new Map(alerts.map((alert) => [alert.id, alert])).values()];
}

async function runVodovodKotorCollector({
  cachePath = env.VODOVOD_KOTOR_CACHE_PATH,
  refresh,
  writeOutput = console.log,
}: {
  cachePath?: string;
  refresh?: () => Promise<VodovodKotorRefreshResult>;
  writeOutput?: (line: string) => void;
} = {}): Promise<VodovodKotorCollectorResult> {
  const lock = await acquireRefreshLock(dirname(cachePath), {
    lockFileName: ".vodovod-kotor-refresh.lock",
  });
  if (!("release" in lock)) {
    const summary = {
      alertCount: 0,
      cachePath,
      cacheStatus: "unavailable" as const,
      cityId: "kotor" as const,
      completedAt: new Date().toISOString(),
      retainedPreviousSnapshot: false,
      status: "already-running" as const,
      warnings: [],
    };
    writeOutput(JSON.stringify({ provider: "vodovod-kotor", ...summary }));
    return { exitCode: 0, summary };
  }
  try {
    const result = await (
      refresh ??
      (() =>
        refreshVodovodKotor({
          cache: {
            read: () => readVodovodKotorCache(cachePath),
            write: (snapshot) => writeVodovodKotorCache(snapshot, cachePath),
          },
          httpClient: createVodovodKotorHttpClient(),
        }))
    )();
    const summary = {
      alertCount: result.snapshot?.alerts.length ?? 0,
      cachePath,
      cacheStatus:
        result.snapshot?.freshnessStatus ?? ("unavailable" as VodovodKotorFreshnessStatus),
      cityId: "kotor" as const,
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
    writeOutput(JSON.stringify({ provider: "vodovod-kotor", ...summary }));
    return { exitCode: result.success || result.retainedPreviousSnapshot ? 0 : 1, summary };
  } finally {
    await lock.release();
  }
}

async function getVodovodKotorCityAlerts({
  context,
  mode,
  now = () => new Date(),
  readCache = readVodovodKotorCache,
}: {
  context: CityContext;
  mode: VodovodKotorProviderMode;
  now?: () => Date;
  readCache?: () => Promise<VodovodKotorCacheSnapshot | null>;
}) {
  if (
    mode === "disabled" ||
    !isCitySupportedByProvider(context.city, vodovodKotorProviderMetadata.supportedCityIds)
  ) {
    return {
      alerts: [],
      freshnessStatus: "unavailable" as const,
      mode: "disabled" as const,
      providerId: "vodovod-kotor" as const,
    };
  }
  try {
    const cache = await readCache();
    if (!cache)
      return {
        alerts: [],
        freshnessStatus: "unavailable" as const,
        mode,
        providerId: "vodovod-kotor" as const,
      };
    return {
      alerts: cache.alerts
        .map((alert) => refreshVodovodKotorAlertStatus(alert, now()))
        .filter((alert) => alert.status !== "expired"),
      freshnessStatus: cache.freshnessStatus,
      lastSuccessfulUpdate: new Date(cache.lastSuccessfulRefreshAt),
      mode,
      providerId: "vodovod-kotor" as const,
    };
  } catch {
    return {
      alerts: [],
      freshnessStatus: "unavailable" as const,
      mode,
      providerId: "vodovod-kotor" as const,
    };
  }
}

function refreshVodovodKotorAlertStatus(alert: CityAlert, now: Date) {
  if (alert.expectedEndAt && alert.expectedEndAt <= now)
    return { ...alert, status: "expired" as const };
  if (alert.startsAt && alert.startsAt > now) return { ...alert, status: "scheduled" as const };
  if (
    alert.type === "waterTankerSchedule" &&
    alert.publishedAt &&
    !isSamePodgoricaDay(alert.publishedAt, now)
  ) {
    return { ...alert, status: "expired" as const };
  }
  return alert;
}

const vodovodKotorProviderMetadata: ProviderMetadata = {
  cachePath: env.VODOVOD_KOTOR_CACHE_PATH,
  displayName: "Vodovod i kanalizacija Kotor water notices",
  enabled: true,
  id: "vodovod-kotor",
  officialSource: vodovodKotorServiceInformationUrl,
  refreshIntervalMinutes: 120,
  supportedCityIds: ["kotor"],
  supportsMultipleCities: false,
};

export {
  assertVodovodKotorUrl,
  createVodovodKotorHttpClient,
  discoverVodovodKotorNotices,
  getVodovodKotorCityAlerts,
  parseVodovodKotorNotice,
  readVodovodKotorCache,
  refreshVodovodKotor,
  runVodovodKotorCollector,
  vodovodKotorProviderMetadata,
  vodovodKotorServiceInformationUrl,
  writeVodovodKotorCache,
  VodovodKotorError,
  type VodovodKotorCacheSnapshot,
  type VodovodKotorCollectorResult,
  type VodovodKotorFreshnessStatus,
  type VodovodKotorHttpClient,
  type VodovodKotorNoticeLink,
  type VodovodKotorRefreshResult,
};
