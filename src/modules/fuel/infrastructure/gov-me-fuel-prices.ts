import { dirname } from "node:path";

import { env } from "@/config/env";
import { isFeatureEnabled } from "@/shared/config/features";
import {
  fuelProductIds,
  isCompleteFuelPriceCalculation,
  mergeFuelCalculations,
  sortFuelCalculations,
  type FuelPriceCalculation,
  type FuelPriceChange,
  type FuelProductId,
  type FuelProductPrice,
} from "@/modules/fuel/domain/fuel-price";
import {
  calculateCacheFreshness,
  nodeFileSystem,
  writeJsonCache,
  type CacheFileSystem,
} from "@/shared/lib/cache";
import { defaultTimeZone } from "@/shared/lib/date";
import { acquireRefreshLock } from "@/shared/lib/refresh-lock";

const govMeOrigin = "https://www.gov.me";
// The general, publication-date-ordered official search finds current fuel notices even when the
// ministry's historical tag page has not yet been updated. The tag page remains a secondary
// source so an older official calculation can still be discovered when the search omits it.
const govMeFuelListingUrl = `${govMeOrigin}/pretraga?at=1&sort=published_at&q=Nove%20cijene%20goriva&ou=`;
const govMeFuelTaggedListingUrl = `${govMeOrigin}/pretraga?tags=254`;
const fuelSourceName = "Ministarstvo energetike i rudarstva";
const maximumResponseLength = 3_000_000;
// A per-run crawl bound, not a history bound: one refresh reads at most this many listed articles.
// The stored history itself accumulates and is never trimmed.
const maximumArticlesPerRefresh = 12;

type FuelFreshnessStatus = "fresh" | "stale" | "unavailable";
type FuelProviderMode = "disabled" | "live";

interface FuelCacheSnapshot {
  calculations: FuelPriceCalculation[];
  fetchedAt: string;
  freshnessStatus: FuelFreshnessStatus;
  lastRefreshError?: string;
  lastSuccessfulRefreshAt: string;
  parserWarnings: string[];
  schemaVersion: 1;
  source: typeof fuelSourceName;
  sourceUrl: string;
}

interface FuelHttpClient {
  get(url: string): Promise<string>;
}

interface FuelRefreshResult {
  errorCode?: string;
  retainedPreviousSnapshot: boolean;
  snapshot: FuelCacheSnapshot | null;
  success: boolean;
  warnings: string[];
}

interface FuelCollectorResult {
  exitCode: 0 | 1;
  summary: {
    cachePath: string;
    cacheStatus: FuelFreshnessStatus;
    calculationCount: number;
    completedAt: string;
    errorCode?: string;
    retainedPreviousSnapshot: boolean;
    status: "already-running" | "retained" | "success" | "unavailable";
    warnings: string[];
  };
}

class FuelPricesError extends Error {
  readonly code:
    | "article-unavailable"
    | "cache-read-failed"
    | "cache-write-failed"
    | "gov-me-host-rejected"
    | "listing-unavailable"
    | "parser-unrecognized";

  constructor(code: FuelPricesError["code"], message: string) {
    super(message);
    this.name = "FuelPricesError";
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

function assertGovMeUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !["gov.me", "www.gov.me"].includes(url.hostname)) {
      throw new Error();
    }
  } catch {
    throw new FuelPricesError("gov-me-host-rejected", "gov.me URL host is not allowed.");
  }
}

function isFuelDiscoveryUrl(value: string) {
  return value === govMeFuelListingUrl || value === govMeFuelTaggedListingUrl;
}

function createGovMeFuelHttpClient({
  fetchImplementation = fetch,
  timeoutMs = 15_000,
}: {
  fetchImplementation?: FetchImplementation;
  timeoutMs?: number;
} = {}): FuelHttpClient {
  return {
    async get(requestedUrl) {
      assertGovMeUrl(requestedUrl);
      try {
        const response = await fetchImplementation(requestedUrl, {
          headers: {
            Accept: "text/html,application/xhtml+xml",
            "User-Agent": "Gradom/0.1 (+https://gradom.me)",
          },
          signal: AbortSignal.timeout(timeoutMs),
        });
        assertGovMeUrl(response.url ?? requestedUrl);
        if (!response.ok) {
          throw new FuelPricesError(
            isFuelDiscoveryUrl(requestedUrl) ? "listing-unavailable" : "article-unavailable",
            "gov.me did not return a successful response.",
          );
        }
        const body = await response.text();
        if (!body.trim() || body.length > maximumResponseLength) {
          throw new FuelPricesError("parser-unrecognized", "gov.me response is unusable.");
        }
        return body;
      } catch (error) {
        if (error instanceof FuelPricesError) throw error;
        throw new FuelPricesError(
          isFuelDiscoveryUrl(requestedUrl) ? "listing-unavailable" : "article-unavailable",
          "gov.me request failed.",
        );
      }
    },
  };
}

// Only the known fuel-price article family is accepted. General GOV.ME search results include
// other ministry articles that mention fuel, but those are never candidates for price parsing.
const fuelArticleHrefPattern =
  /href\s*=\s*["'](\/clanak\/nove-cijene-goriva(?:-od-\d{8}|-\d+))["']/gi;

interface FuelArticleCandidate {
  listingIndex: number;
  listingPriority: number;
  publishedAt?: string;
  url: string;
}

function parseListingPublicationDate(value: string) {
  const timeMatch = /<time\b[^>]*>([\s\S]*?)<\/time>/i.exec(value);
  return timeMatch
    ? parseMontenegrinDate(decodeEntities(timeMatch[1].replace(/<[^>]*>/g, " ")))
    : undefined;
}

function discoverFuelArticleCandidates(listingHtml: string, listingPriority: number) {
  const matches = [...listingHtml.matchAll(fuelArticleHrefPattern)];
  return matches.map((match, listingIndex) => {
    const nextMatchIndex = matches[listingIndex + 1]?.index ?? listingHtml.length;
    const resultExcerpt = listingHtml.slice(match.index, nextMatchIndex);
    const path = match[1];
    const publishedAt = parseListingPublicationDate(resultExcerpt);

    return {
      listingIndex,
      listingPriority,
      ...(publishedAt ? { publishedAt } : {}),
      url: `${govMeOrigin}${path}`,
    };
  });
}

function discoverFuelArticleUrls(listingHtml: string | readonly string[]) {
  const listings = typeof listingHtml === "string" ? [listingHtml] : listingHtml;
  const candidates = listings.flatMap((html, listingPriority) =>
    discoverFuelArticleCandidates(html, listingPriority),
  );
  const uniqueCandidates = new Map<string, FuelArticleCandidate>();

  for (const candidate of candidates) {
    const existing = uniqueCandidates.get(candidate.url);
    if (!existing) {
      uniqueCandidates.set(candidate.url, candidate);
      continue;
    }
    if (
      candidate.publishedAt &&
      (!existing.publishedAt || candidate.publishedAt > existing.publishedAt)
    ) {
      uniqueCandidates.set(candidate.url, candidate);
    }
  }

  return [...uniqueCandidates.values()]
    .sort(
      (left, right) =>
        (right.publishedAt ?? "").localeCompare(left.publishedAt ?? "") ||
        left.listingPriority - right.listingPriority ||
        left.listingIndex - right.listingIndex,
    )
    .slice(0, maximumArticlesPerRefresh)
    .map(({ url }) => url);
}

const montenegrinMonths: Record<string, number> = {
  april: 4,
  avgust: 8,
  decembar: 12,
  februar: 2,
  januar: 1,
  jul: 7,
  jun: 6,
  maj: 5,
  mart: 3,
  novembar: 11,
  oktobar: 10,
  septembar: 9,
};

function toIsoDate(day: number, month: number, year: number) {
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;
  const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const parsed = new Date(`${iso}T12:00:00.000Z`);
  return parsed.getUTCDate() === day && parsed.getUTCMonth() + 1 === month ? iso : undefined;
}

// The ministry writes the effective date two ways, both observed in the live archive: the older
// numeric "od datuma 16.07.2026. godine" and the newer long form "od 4. avgusta 2026. godine".
// Both are supported; nothing else is guessed at.
function parseMontenegrinDate(value: string) {
  const numeric = /(\d{1,2})\s*\.\s*(\d{1,2})\s*\.\s*(\d{4})/.exec(value);
  if (numeric) return toIsoDate(Number(numeric[1]), Number(numeric[2]), Number(numeric[3]));

  const named = /(\d{1,2})\s*\.?\s*([A-Za-zČĆŽŠĐčćžšđ]+)\s+(\d{4})/.exec(value);
  if (!named) return undefined;
  const monthKey = Object.keys(montenegrinMonths).find((month) =>
    named[2].toLocaleLowerCase("sr-Latn-ME").startsWith(month),
  );
  if (!monthKey) return undefined;
  return toIsoDate(Number(named[1]), montenegrinMonths[monthKey], Number(named[3]));
}

const productMatchers: { id: FuelProductId; pattern: RegExp }[] = [
  { id: "eurosuper98", pattern: /^EUROSUPER\s*98\b/i },
  { id: "eurosuper95", pattern: /^EUROSUPER\s*95\b/i },
  // Until late May 2026 the ministry wrote the same two petrols as "BMB 98" / "BMB 95". This is a
  // rename, not a different product, and the source says so itself: the 26.05.2026 article lists
  // EUROSUPER 98 at 1,68 and EUROSUPER 95 at 1,65 with "bez promjene" against the 19.05.2026
  // article, whose BMB 98 and BMB 95 rows carry exactly those prices. The 31.03.2026 and
  // 07.04.2026 articles go further and print both namings with identical values in one article.
  { id: "eurosuper98", pattern: /^BMB\s*98\b/i },
  { id: "eurosuper95", pattern: /^BMB\s*95\b/i },
  { id: "eurodiesel", pattern: /^EURODIZEL\b/i },
  { id: "heatingOil", pattern: /^LO[ŽZ]\s*ULJE\b/i },
];

// One price row. "e ur" is a recurring typo in the official source (seen on the diesel row of
// several articles), so the currency token tolerates the stray space. Older articles write the
// unit as "eur/l" rather than "eur", and wrap the change in brackets — "1.68 eur/l +0,04" and
// "1.59 eur/l (+0,03)" both occur — so both are accepted; without them the official Promjena on
// those articles was silently dropped. The change column is still optional, may be the words
// "bez promjene", may put a space between sign and number, and uses a comma or a dot as the
// decimal separator — sometimes both inside the same article.
const priceRowPattern =
  /^(.+?)\s+(\d{1,2}[.,]\d{1,2})\s*e\s?ur\b(?:\s*\/\s*l\b)?\s*\(?\s*(bez\s+promjene|[+-]\s*\d+[.,]\d{1,2})?/i;

function toCents(value: string) {
  const [whole, fraction = "0"] = value.replace(",", ".").split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0").slice(0, 2));
  return Number.isFinite(cents) ? cents : undefined;
}

function parseChange(raw: string | undefined): FuelPriceChange | undefined {
  if (!raw) return undefined;
  if (/bez\s+promjene/i.test(raw)) return { cents: 0, direction: "unchanged", source: "official" };

  const match = /([+-])\s*(\d+[.,]\d{1,2})/.exec(raw);
  if (!match) return undefined;
  const cents = toCents(match[2]);
  if (cents === undefined) return undefined;

  return {
    cents,
    direction: cents === 0 ? "unchanged" : match[1] === "-" ? "decrease" : "increase",
    source: "official",
  };
}

function toArticleLines(html: string) {
  const body = html
    .replace(/<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<(?:br|\/p|\/li|\/div|\/h[1-6]|\/tr|\/td)\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, " ");
  return decodeEntities(body)
    .split("\n")
    .map((line) => line.replace(/[^\S\n]+/g, " ").trim())
    .filter((line) => line.length > 0);
}

const namedEntities: Record<string, string> = {
  amp: "&",
  apos: "'",
  bull: "•",
  gt: ">",
  lt: "<",
  mdash: "—",
  nbsp: " ",
  ndash: "–",
  quot: '"',
  scaron: "š",
  Scaron: "Š",
};

// gov.me serves the Montenegrin diacritics as numeric character references on some articles
// (`va&#382;e`, `LO&#381; ULJE`), so decoding only a handful of named entities made every such
// article unparseable: the validity sentence and the "Lož ulje" row simply never matched. Numeric
// references are therefore decoded generically, decimal and hexadecimal alike.
function decodeEntities(value: string) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (match, hex: string) =>
      codePointOrMatch(match, parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (match, decimal: string) => codePointOrMatch(match, Number(decimal)))
    .replace(/&([a-z]+);/gi, (match, name: string) => namedEntities[name] ?? match);
}

function codePointOrMatch(match: string, codePoint: number) {
  if (!Number.isInteger(codePoint) || codePoint < 1 || codePoint > 0x10ffff) return match;
  try {
    return String.fromCodePoint(codePoint);
  } catch {
    return match;
  }
}

function parseFuelArticle(html: string, sourceUrl: string): FuelPriceCalculation | undefined {
  const lines = toArticleLines(html);

  const publishedLine = lines.find((line) => /^Objavljeno\s*:/i.test(line));
  const publishedAt = publishedLine ? parseMontenegrinDate(publishedLine) : undefined;

  // The effective date comes from the validity sentence, and only from it — the publication line
  // above is a different fact and is never substituted here.
  const effectiveLine = lines.find((line) => /\bva[žz]e\b|\bva[žz]i[ćc]e\b/i.test(line));
  const effectiveDate = effectiveLine ? parseMontenegrinDate(effectiveLine) : undefined;
  if (!effectiveDate || !publishedAt) return undefined;

  const prices: FuelProductPrice[] = [];
  for (const line of lines) {
    const row = priceRowPattern.exec(line);
    if (!row) continue;
    const matcher = productMatchers.find((candidate) => candidate.pattern.test(row[1].trim()));
    if (!matcher) continue;
    if (prices.some((price) => price.productId === matcher.id)) continue;

    const priceCents = toCents(row[2]);
    if (priceCents === undefined || priceCents <= 0) continue;
    const change = parseChange(row[3]);
    prices.push({ ...(change ? { change } : {}), priceCents, productId: matcher.id });
  }

  const nextLine = lines.find((line) => /^Naredni\s+obra[čc]un/i.test(line));
  const nextCalculationDate = nextLine ? parseMontenegrinDate(nextLine) : undefined;

  const calculation: FuelPriceCalculation = {
    effectiveDate,
    ...(nextCalculationDate ? { nextCalculationDate } : {}),
    prices: fuelProductIds.flatMap(
      (productId) => prices.filter((price) => price.productId === productId) ?? [],
    ),
    publishedAt,
    sourceName: fuelSourceName,
    sourceUrl,
  };

  // All four or nothing: publishing three of four products would silently drop diesel exactly the
  // way the "e ur" typo did during the source audit.
  return isCompleteFuelPriceCalculation(calculation) ? calculation : undefined;
}

function getIsoDateInDefaultTimeZone(value: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: defaultTimeZone,
    year: "numeric",
  }).formatToParts(value);
  const values = Object.fromEntries(
    parts
      .filter(({ type }) => type !== "literal")
      .map(({ type, value: partValue }) => [type, partValue]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

function calculateFuelFreshness(
  fetchedAt: Date | undefined,
  calculations: readonly FuelPriceCalculation[],
  now = new Date(),
) {
  const fetchFreshness = calculateCacheFreshness(fetchedAt, now, env.FUEL_CACHE_FRESHNESS_MINUTES);
  if (fetchFreshness !== "fresh") return fetchFreshness;

  const currentCalculation = sortFuelCalculations(calculations)[0];
  if (
    currentCalculation?.nextCalculationDate &&
    currentCalculation.nextCalculationDate < getIsoDateInDefaultTimeZone(now)
  ) {
    return "stale";
  }
  return "fresh";
}

async function readFuelCache(
  cachePath = env.FUEL_CACHE_PATH,
  fileSystem: Pick<CacheFileSystem, "readFile"> = nodeFileSystem,
  now = new Date(),
): Promise<FuelCacheSnapshot | null> {
  try {
    const value = JSON.parse(await fileSystem.readFile(cachePath, "utf8")) as unknown;
    if (!isFuelCacheSnapshot(value)) return null;
    return {
      ...value,
      freshnessStatus: calculateFuelFreshness(new Date(value.fetchedAt), value.calculations, now),
    };
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT")
      return null;
    throw new FuelPricesError("cache-read-failed", "Fuel price cache could not be read.");
  }
}

function isFuelCacheSnapshot(value: unknown): value is FuelCacheSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Record<string, unknown>;
  return (
    snapshot.schemaVersion === 1 &&
    snapshot.source === fuelSourceName &&
    typeof snapshot.fetchedAt === "string" &&
    typeof snapshot.lastSuccessfulRefreshAt === "string" &&
    Array.isArray(snapshot.calculations) &&
    snapshot.calculations.every(
      (calculation) =>
        typeof calculation === "object" &&
        calculation !== null &&
        typeof (calculation as FuelPriceCalculation).effectiveDate === "string" &&
        Array.isArray((calculation as FuelPriceCalculation).prices),
    )
  );
}

async function writeFuelCache(
  snapshot: FuelCacheSnapshot,
  cachePath = env.FUEL_CACHE_PATH,
  fileSystem: CacheFileSystem = nodeFileSystem,
) {
  try {
    await writeJsonCache(snapshot, cachePath, fileSystem);
  } catch {
    throw new FuelPricesError("cache-write-failed", "Fuel price cache could not be updated.");
  }
}

async function refreshFuelPrices({
  cache,
  httpClient,
  now = () => new Date(),
}: {
  cache: {
    read(): Promise<FuelCacheSnapshot | null>;
    write(snapshot: FuelCacheSnapshot): Promise<void>;
  };
  httpClient: FuelHttpClient;
  now?: () => Date;
}): Promise<FuelRefreshResult> {
  let previous: FuelCacheSnapshot | null;
  try {
    previous = await cache.read();
  } catch (error) {
    return retainFuelSnapshot(null, errorCode(error), []);
  }

  try {
    const listingResponses = await Promise.allSettled([
      httpClient.get(govMeFuelListingUrl),
      httpClient.get(govMeFuelTaggedListingUrl),
    ]);
    const listingHtml = listingResponses.flatMap((response) =>
      response.status === "fulfilled" ? [response.value] : [],
    );
    if (listingHtml.length === 0) {
      throw new FuelPricesError("listing-unavailable", "Fuel article discovery is unavailable.");
    }

    const articleUrls = discoverFuelArticleUrls(listingHtml);
    if (articleUrls.length === 0) {
      return retainFuelSnapshot(previous, "parser-unrecognized", ["no-fuel-articles-discovered"]);
    }

    const known = new Map(
      (previous?.calculations ?? []).map((calculation) => [calculation.sourceUrl, calculation]),
    );
    // Routine refreshes only fetch what is not already stored, so an unchanged listing costs one
    // request. The newest article is always re-read so a corrected republication is picked up.
    const [newestUrl, ...olderUrls] = articleUrls;
    const missingOlder = olderUrls.filter((url) => !known.has(url));
    const warnings: string[] = [];
    const parsed: FuelPriceCalculation[] = [];

    for (const url of [newestUrl, ...missingOlder]) {
      try {
        const calculation = parseFuelArticle(await httpClient.get(url), url);
        if (calculation) parsed.push(calculation);
        else warnings.push(`article-unparsed:${url}`);
      } catch {
        warnings.push(`article-unavailable:${url}`);
      }
    }

    // Fail closed: if the newest article did not yield a complete calculation, the current prices
    // stay exactly as they were rather than being replaced by an older or partial one.
    const newestParsed = parsed.some((calculation) => calculation.sourceUrl === newestUrl);
    if (!newestParsed) {
      return retainFuelSnapshot(previous, "parser-unrecognized", [
        "newest-article-unparsed",
        ...warnings,
      ]);
    }

    const calculations = mergeFuelCalculations(previous?.calculations ?? [], parsed);
    const refreshedAt = now();
    const timestamp = refreshedAt.toISOString();
    const freshnessStatus = calculateFuelFreshness(refreshedAt, calculations, refreshedAt);
    if (freshnessStatus === "stale") warnings.push("latest-calculation-validity-ended");
    const snapshot: FuelCacheSnapshot = {
      calculations,
      fetchedAt: timestamp,
      freshnessStatus,
      lastSuccessfulRefreshAt: timestamp,
      parserWarnings: warnings,
      schemaVersion: 1,
      source: fuelSourceName,
      sourceUrl: govMeFuelListingUrl,
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
    return retainFuelSnapshot(previous, errorCode(error), []);
  }
}

function retainFuelSnapshot(
  previous: FuelCacheSnapshot | null,
  errorCode: string,
  warnings: string[],
): FuelRefreshResult {
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
  return error instanceof FuelPricesError ? error.code : "fuel-refresh-failed";
}

async function runFuelPricesCollector({
  cachePath = env.FUEL_CACHE_PATH,
  refresh,
  writeOutput = console.log,
}: {
  cachePath?: string;
  refresh?: () => Promise<FuelRefreshResult>;
  writeOutput?: (line: string) => void;
} = {}): Promise<FuelCollectorResult> {
  const lock = await acquireRefreshLock(dirname(cachePath), {
    lockFileName: ".fuel-prices-refresh.lock",
  });
  if (!("release" in lock)) {
    const summary = {
      cachePath,
      cacheStatus: "unavailable" as const,
      calculationCount: 0,
      completedAt: new Date().toISOString(),
      retainedPreviousSnapshot: false,
      status: "already-running" as const,
      warnings: [],
    };
    writeOutput(JSON.stringify({ provider: "fuel-prices", ...summary }));
    return { exitCode: 0, summary };
  }

  try {
    const result = await (
      refresh ??
      (() =>
        refreshFuelPrices({
          cache: {
            read: () => readFuelCache(cachePath),
            write: (snapshot) => writeFuelCache(snapshot, cachePath),
          },
          httpClient: createGovMeFuelHttpClient(),
        }))
    )();
    const summary = {
      cachePath,
      cacheStatus: result.snapshot?.freshnessStatus ?? ("unavailable" as FuelFreshnessStatus),
      calculationCount: result.snapshot?.calculations.length ?? 0,
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
    writeOutput(JSON.stringify({ provider: "fuel-prices", ...summary }));
    return { exitCode: result.success || result.retainedPreviousSnapshot ? 0 : 1, summary };
  } finally {
    await lock.release();
  }
}

interface FuelPricesReadResult {
  calculations: readonly FuelPriceCalculation[];
  freshnessStatus: FuelFreshnessStatus;
  lastSuccessfulUpdate?: Date;
}

async function getFuelPrices({
  mode = isFeatureEnabled("fuelPrices") ? "live" : "disabled",
  readCache = readFuelCache,
}: {
  mode?: FuelProviderMode;
  readCache?: () => Promise<FuelCacheSnapshot | null>;
} = {}): Promise<FuelPricesReadResult> {
  if (mode === "disabled") return { calculations: [], freshnessStatus: "unavailable" };

  try {
    const cache = await readCache();
    if (!cache || cache.calculations.length === 0) {
      return { calculations: [], freshnessStatus: "unavailable" };
    }
    return {
      calculations: sortFuelCalculations(cache.calculations),
      freshnessStatus: cache.freshnessStatus,
      lastSuccessfulUpdate: new Date(cache.lastSuccessfulRefreshAt),
    };
  } catch {
    return { calculations: [], freshnessStatus: "unavailable" };
  }
}

export {
  assertGovMeUrl,
  createGovMeFuelHttpClient,
  calculateFuelFreshness,
  discoverFuelArticleUrls,
  fuelSourceName,
  getFuelPrices,
  govMeFuelListingUrl,
  govMeFuelTaggedListingUrl,
  parseFuelArticle,
  readFuelCache,
  refreshFuelPrices,
  runFuelPricesCollector,
  writeFuelCache,
  FuelPricesError,
  type FuelCacheSnapshot,
  type FuelCollectorResult,
  type FuelFreshnessStatus,
  type FuelHttpClient,
  type FuelPricesReadResult,
  type FuelRefreshResult,
};
