import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { derivePreviousChange, formatFuelPrice } from "../domain/fuel-price.ts";
import {
  assertGovMeUrl,
  discoverFuelArticleUrls,
  getFuelPrices,
  govMeFuelListingUrl,
  parseFuelArticle,
  refreshFuelPrices,
  type FuelCacheSnapshot,
} from "./gov-me-fuel-prices.ts";

const fixture = async (name: string) =>
  readFile(new URL(`./__fixtures__/${name}`, import.meta.url), "utf8");

const august = "https://www.gov.me/clanak/nove-cijene-goriva-od-04082026";
const june = "https://www.gov.me/clanak/nove-cijene-goriva-od-02062026";

type PriceBearing = { prices: { priceCents: number; productId: string }[] };

const priceOf = (calculation: PriceBearing, id: string) =>
  calculation.prices.find((price) => price.productId === id)?.priceCents;

test("parses all four official products from the newest article shape", async () => {
  const calculation = parseFuelArticle(await fixture("gov-me-fuel-2026-08-04.html"), august);
  assert.ok(calculation);

  assert.equal(priceOf(calculation, "eurosuper95"), 175);
  assert.equal(priceOf(calculation, "eurosuper98"), 179);
  assert.equal(priceOf(calculation, "eurodiesel"), 185);
  assert.equal(priceOf(calculation, "heatingOil"), 180);
  assert.equal(calculation.sourceUrl, august);
  assert.equal(calculation.sourceName, "Ministarstvo energetike i rudarstva");
});

test("keeps publication, effective and next-calculation dates separate", async () => {
  const calculation = parseFuelArticle(await fixture("gov-me-fuel-2026-08-04.html"), august);
  assert.ok(calculation);

  // Published the evening before the prices apply — conflating these shifts every price by a day.
  assert.equal(calculation.publishedAt, "2026-08-03");
  assert.equal(calculation.effectiveDate, "2026-08-04");
  assert.equal(calculation.nextCalculationDate, "2026-08-10");
  assert.notEqual(calculation.publishedAt, calculation.effectiveDate);
});

test("reads the older numeric date phrasing and omits an absent next calculation", async () => {
  const calculation = parseFuelArticle(await fixture("gov-me-fuel-2026-06-02.html"), june);
  assert.ok(calculation);

  assert.equal(calculation.effectiveDate, "2026-06-02");
  assert.equal(calculation.publishedAt, "2026-06-01");
  // Most articles never state it; inventing one would be a fabricated fact.
  assert.equal(calculation.nextCalculationDate, undefined);
});

test("survives every quirk the official source actually publishes", async () => {
  const calculation = parseFuelArticle(await fixture("gov-me-fuel-2026-06-02.html"), june);
  assert.ok(calculation);
  const change = (id: string) => calculation.prices.find((p) => p.productId === id)?.change;

  // "e ur" — a recurring typo on the diesel row that silently dropped the product during the audit.
  assert.equal(priceOf(calculation, "eurodiesel"), 166);
  assert.deepEqual(change("eurodiesel"), { cents: 3, direction: "decrease", source: "official" });
  // "bez promjene" instead of a number.
  assert.deepEqual(change("eurosuper95"), { cents: 0, direction: "unchanged", source: "official" });
  // A space between the sign and the value.
  assert.deepEqual(change("heatingOil"), { cents: 13, direction: "decrease", source: "official" });
  // Comma decimal here, dot decimal in the August article — both accepted.
  assert.deepEqual(change("eurosuper98"), { cents: 1, direction: "increase", source: "official" });
});

test("accepts dot decimals in the change column too", async () => {
  const calculation = parseFuelArticle(await fixture("gov-me-fuel-2026-08-04.html"), august);
  assert.ok(calculation);
  const diesel = calculation.prices.find((price) => price.productId === "eurodiesel");

  assert.deepEqual(diesel?.change, { cents: 6, direction: "increase", source: "official" });
});

test("stores prices as integer cents so display never drifts", async () => {
  const calculation = parseFuelArticle(await fixture("gov-me-fuel-2026-08-04.html"), august);
  assert.ok(calculation);

  for (const price of calculation.prices) assert.equal(Number.isInteger(price.priceCents), true);
  assert.equal(formatFuelPrice(175), "1,75");
  assert.equal(formatFuelPrice(180), "1,80");
});

test("rejects an article that does not yield all four products", async () => {
  // Three of four is never published: that is exactly how the "e ur" typo hid diesel.
  assert.equal(parseFuelArticle(await fixture("gov-me-fuel-malformed.html"), august), undefined);
  assert.equal(parseFuelArticle(await fixture("gov-me-fuel-unrelated.html"), august), undefined);
});

test("discovers only fuel articles from the shared ministry listing", async () => {
  const urls = discoverFuelArticleUrls(await fixture("gov-me-fuel-listing.html"));

  assert.deepEqual(urls, [august, june]);
  assert.equal(
    urls.some((url) => url.includes("saopstenje")),
    false,
  );
});

test("only requests the official host", () => {
  assert.throws(() => assertGovMeUrl("https://gov.me.evil.test/clanak/x"));
  assert.throws(() => assertGovMeUrl("http://www.gov.me/clanak/x"));
  assert.doesNotThrow(() => assertGovMeUrl(govMeFuelListingUrl));
});

const stubCache = (initial: FuelCacheSnapshot | null = null) => {
  let stored = initial;
  return {
    read: async () => stored,
    written: () => stored,
    write: async (snapshot: FuelCacheSnapshot) => {
      stored = snapshot;
    },
  };
};

const clientFor = (pages: Record<string, string>) => ({
  get: async (url: string) => {
    const body = pages[url];
    if (body === undefined) throw new Error(`unexpected fetch ${url}`);
    return body;
  },
});

const now = () => new Date("2026-08-04T06:00:00.000Z");

test("a successful refresh stores newest-first, deduplicated history", async () => {
  const cache = stubCache();
  const result = await refreshFuelPrices({
    cache,
    httpClient: clientFor({
      [govMeFuelListingUrl]: await fixture("gov-me-fuel-listing.html"),
      [august]: await fixture("gov-me-fuel-2026-08-04.html"),
      [june]: await fixture("gov-me-fuel-2026-06-02.html"),
    }),
    now,
  });

  assert.equal(result.success, true);
  const stored = result.snapshot;
  assert.ok(stored);
  assert.deepEqual(
    stored.calculations.map(({ effectiveDate }) => effectiveDate),
    ["2026-08-04", "2026-06-02"],
  );
  assert.equal(stored.freshnessStatus, "fresh");
});

test("re-running against an unchanged listing is idempotent", async () => {
  const pages = {
    [govMeFuelListingUrl]: await fixture("gov-me-fuel-listing.html"),
    [august]: await fixture("gov-me-fuel-2026-08-04.html"),
    [june]: await fixture("gov-me-fuel-2026-06-02.html"),
  };
  const cache = stubCache();
  await refreshFuelPrices({ cache, httpClient: clientFor(pages), now });
  const second = await refreshFuelPrices({ cache, httpClient: clientFor(pages), now });

  assert.equal(second.snapshot?.calculations.length, 2);
});

test("a malformed newest article never replaces valid stored prices", async () => {
  const previous: FuelCacheSnapshot = {
    calculations: [
      {
        effectiveDate: "2026-08-04",
        prices: [
          { priceCents: 175, productId: "eurosuper95" },
          { priceCents: 179, productId: "eurosuper98" },
          { priceCents: 185, productId: "eurodiesel" },
          { priceCents: 180, productId: "heatingOil" },
        ],
        publishedAt: "2026-08-03",
        sourceName: "Ministarstvo energetike i rudarstva",
        sourceUrl: august,
      },
    ],
    fetchedAt: "2026-08-04T06:00:00.000Z",
    freshnessStatus: "fresh",
    lastSuccessfulRefreshAt: "2026-08-04T06:00:00.000Z",
    parserWarnings: [],
    schemaVersion: 1,
    source: "Ministarstvo energetike i rudarstva",
    sourceUrl: govMeFuelListingUrl,
  };
  const result = await refreshFuelPrices({
    cache: stubCache(previous),
    httpClient: clientFor({
      [govMeFuelListingUrl]: await fixture("gov-me-fuel-listing.html"),
      [august]: await fixture("gov-me-fuel-malformed.html"),
      [june]: await fixture("gov-me-fuel-2026-06-02.html"),
    }),
    now,
  });

  assert.equal(result.success, false);
  assert.equal(result.retainedPreviousSnapshot, true);
  assert.equal(result.snapshot?.freshnessStatus, "stale");
  // The previous complete calculation is untouched — no zeros, no partial replacement.
  assert.equal(result.snapshot?.calculations[0]?.prices.length, 4);
  assert.equal(result.warnings.includes("newest-article-unparsed"), true);
});

test("derived change is used only against the immediately previous calculation", () => {
  const build = (effectiveDate: string, cents: number) => ({
    effectiveDate,
    prices: [{ priceCents: cents, productId: "eurosuper95" as const }],
    publishedAt: effectiveDate,
    sourceName: "Ministarstvo energetike i rudarstva",
    sourceUrl: august,
  });

  const previous = build("2026-07-28", 170);
  const derived = derivePreviousChange(build("2026-08-04", 175), previous, "eurosuper95");
  assert.deepEqual(derived, { cents: 5, direction: "increase", source: "derived" });
  // With no previous calculation nothing is claimed.
  assert.equal(derivePreviousChange(build("2026-08-04", 175), undefined, "eurosuper95"), undefined);
});

test("an official change always wins over a derived one", () => {
  const current = {
    effectiveDate: "2026-08-04",
    prices: [
      {
        change: { cents: 2, direction: "decrease" as const, source: "official" as const },
        priceCents: 175,
        productId: "eurosuper95" as const,
      },
    ],
    publishedAt: "2026-08-03",
    sourceName: "Ministarstvo energetike i rudarstva",
    sourceUrl: august,
  };
  const previous = {
    effectiveDate: "2026-07-28",
    prices: [{ priceCents: 100, productId: "eurosuper95" as const }],
    publishedAt: "2026-07-27",
    sourceName: "Ministarstvo energetike i rudarstva",
    sourceUrl: june,
  };

  assert.deepEqual(derivePreviousChange(current, previous, "eurosuper95"), {
    cents: 2,
    direction: "decrease",
    source: "official",
  });
});

test("accumulated official history is never truncated by a refresh", async () => {
  // Older than anything the ministry still lists: a refresh can only re-find the newest few
  // articles, so trimming here would permanently lose history that cannot be fetched again.
  const archived = Array.from({ length: 20 }, (unused, index) => ({
    effectiveDate: `2025-1${(index % 2) + 1}-0${(index % 9) + 1}`,
    prices: [{ priceCents: 150 + index, productId: "eurosuper95" as const }],
    publishedAt: "2025-11-30",
    sourceName: "Ministarstvo energetike i rudarstva",
    sourceUrl: june,
  }));
  const stored = new Map(archived.map((entry) => [entry.effectiveDate, entry]));
  const previous: FuelCacheSnapshot = {
    calculations: [...stored.values()],
    fetchedAt: "2026-08-04T06:00:00.000Z",
    freshnessStatus: "fresh",
    lastSuccessfulRefreshAt: "2026-08-04T06:00:00.000Z",
    parserWarnings: [],
    schemaVersion: 1,
    source: "Ministarstvo energetike i rudarstva",
    sourceUrl: govMeFuelListingUrl,
  };
  const result = await refreshFuelPrices({
    cache: stubCache(previous),
    httpClient: clientFor({
      [govMeFuelListingUrl]: await fixture("gov-me-fuel-listing.html"),
      [august]: await fixture("gov-me-fuel-2026-08-04.html"),
      [june]: await fixture("gov-me-fuel-2026-06-02.html"),
    }),
    now,
  });

  const dates = result.snapshot?.calculations.map(({ effectiveDate }) => effectiveDate) ?? [];
  // Every stored calculation survives, plus the two newly parsed ones.
  assert.equal(dates.length, stored.size + 2);
  for (const archivedDate of stored.keys()) assert.equal(dates.includes(archivedDate), true);
  // Still newest-first, so the page can slice the head for display.
  assert.deepEqual([...dates], [...dates].sort((left, right) => right.localeCompare(left)));
});

test("re-parsing an already stored calculation replaces it instead of duplicating it", async () => {
  const previous: FuelCacheSnapshot = {
    calculations: [
      {
        effectiveDate: "2026-08-04",
        prices: [{ priceCents: 1, productId: "eurosuper95" }],
        publishedAt: "2026-08-03",
        sourceName: "Ministarstvo energetike i rudarstva",
        sourceUrl: august,
      },
    ],
    fetchedAt: "2026-08-04T06:00:00.000Z",
    freshnessStatus: "fresh",
    lastSuccessfulRefreshAt: "2026-08-04T06:00:00.000Z",
    parserWarnings: [],
    schemaVersion: 1,
    source: "Ministarstvo energetike i rudarstva",
    sourceUrl: govMeFuelListingUrl,
  };
  const result = await refreshFuelPrices({
    cache: stubCache(previous),
    httpClient: clientFor({
      [govMeFuelListingUrl]: await fixture("gov-me-fuel-listing.html"),
      [august]: await fixture("gov-me-fuel-2026-08-04.html"),
      [june]: await fixture("gov-me-fuel-2026-06-02.html"),
    }),
    now,
  });

  const august2026 = result.snapshot?.calculations.filter(
    ({ effectiveDate }) => effectiveDate === "2026-08-04",
  );
  assert.equal(august2026?.length, 1);
  assert.equal(priceOf(august2026[0], "eurosuper95"), 175);
});

const articleWith = (rows: string) => `<article>
  <h1>Nove cijene goriva od 04.08.2026</h1>
  <p>Objavljeno: 03.08.2026. &bull; 15:57 Autor: Ministarstvo energetike i rudarstva</p>
  <p>Obavje&scaron;tavamo Vas da od 4. avgusta 2026. godine va&#382;e sljede&#263;e cijene:</p>
  ${rows}
</article>`;

test("decodes the numeric character references gov.me publishes its diacritics as", () => {
  // `va&#382;e` and `LO&#381; ULJE` are how the source encodes ž and Ž. Without decoding them the
  // validity sentence and the heating-oil row never match and the whole article is unparseable.
  const calculation = parseFuelArticle(
    articleWith(`<p>EUROSUPER 98 1,79 eur</p>
  <p>EUROSUPER 95 1,75 eur</p>
  <p>EURODIZEL 1,85 eur</p>
  <p>LO&#381; ULJE 1,80 eur</p>`),
    august,
  );

  assert.ok(calculation);
  assert.equal(calculation.effectiveDate, "2026-08-04");
  assert.equal(priceOf(calculation, "heatingOil"), 180);
});

test("numbers elsewhere in the article are never read as fuel prices", () => {
  // Every one of these lines contains a euro amount; none of them is a price row.
  const calculation = parseFuelArticle(
    articleWith(`<p>Akciza iznosi 0,55 eur po litru</p>
  <p>Ukupan prihod je 12,30 eur po stanovniku</p>
  <p>Cijena je 1,75 eur</p>
  <p>EUROSUPER 95 je najprodavaniji derivat</p>`),
    august,
  );

  assert.equal(calculation, undefined);
});

test("a restructured price table fails closed instead of publishing partial prices", () => {
  // If the source ever splits each product and price into its own table cell, the row pattern
  // stops matching. That must yield nothing at all, never a plausible-looking partial calculation.
  const calculation = parseFuelArticle(
    articleWith(`<table><tr><td>EUROSUPER 95</td><td>1,75 eur</td><td>-0.02</td></tr>
  <tr><td>EUROSUPER 98</td><td>1,79 eur</td><td>-0.02</td></tr>
  <tr><td>EURODIZEL</td><td>1,85 eur</td><td>+0.06</td></tr>
  <tr><td>LO&#381; ULJE</td><td>1,80 eur</td><td>+0,01</td></tr></table>`),
    august,
  );

  assert.equal(calculation, undefined);
});

const snapshotOf = (calculations: FuelCacheSnapshot["calculations"]): FuelCacheSnapshot => ({
  calculations,
  fetchedAt: "2026-08-04T06:00:00.000Z",
  freshnessStatus: "fresh",
  lastSuccessfulRefreshAt: "2026-08-04T06:00:00.000Z",
  parserWarnings: [],
  schemaVersion: 1,
  source: "Ministarstvo energetike i rudarstva",
  sourceUrl: govMeFuelListingUrl,
});

const calculationOf = (effectiveDate: string, cents: number) => ({
  effectiveDate,
  prices: [{ priceCents: cents, productId: "eurosuper95" as const }],
  publishedAt: effectiveDate,
  sourceName: "Ministarstvo energetike i rudarstva",
  sourceUrl: august,
});

test("the read path returns the newest calculation first, whatever the cache order", async () => {
  // The page takes calculations[0] as the current price, so an unordered cache file must not be
  // able to put a superseded calculation on the page.
  const result = await getFuelPrices({
    mode: "live",
    readCache: async () =>
      snapshotOf([
        calculationOf("2026-07-21", 170),
        calculationOf("2026-08-04", 175),
        calculationOf("2026-07-28", 177),
      ]),
  });

  assert.deepEqual(
    result.calculations.map(({ effectiveDate }) => effectiveDate),
    ["2026-08-04", "2026-07-28", "2026-07-21"],
  );
  assert.equal(result.freshnessStatus, "fresh");
});

test("a disabled feature never even reads the cache", async () => {
  let reads = 0;
  const result = await getFuelPrices({
    mode: "disabled",
    readCache: async () => {
      reads += 1;
      return snapshotOf([calculationOf("2026-08-04", 175)]);
    },
  });

  assert.equal(reads, 0);
  assert.deepEqual(result.calculations, []);
  assert.equal(result.freshnessStatus, "unavailable");
});

test("a missing, empty or unreadable cache degrades instead of throwing", async () => {
  // This is the first-deploy state: the volume is mounted but no collector has run yet.
  const missing = await getFuelPrices({ mode: "live", readCache: async () => null });
  assert.equal(missing.freshnessStatus, "unavailable");
  assert.deepEqual(missing.calculations, []);

  const empty = await getFuelPrices({ mode: "live", readCache: async () => snapshotOf([]) });
  assert.equal(empty.freshnessStatus, "unavailable");

  const broken = await getFuelPrices({
    mode: "live",
    readCache: async () => {
      throw new Error("cache read failed");
    },
  });
  assert.equal(broken.freshnessStatus, "unavailable");
  assert.deepEqual(broken.calculations, []);
});
