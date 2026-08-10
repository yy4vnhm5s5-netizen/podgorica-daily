import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readSource = () => readFile(new URL("./power-outages-page.tsx", import.meta.url), "utf8");

// Three of the five electricity pages were rendering the empty branch in production, and that
// branch carried no staleness signal at all — a snapshot we had failed to refresh looked exactly
// like a freshly confirmed "nothing planned".
test("warns about stale data on an empty result, not only on a populated one", async () => {
  const source = await readSource();

  assert.match(
    source,
    /\{result\.status !== "unavailable" && result\.freshnessStatus === "stale" \? \(/u,
  );
  // The banner is no longer nested inside the populated branch.
  assert.doesNotMatch(
    source,
    /<div className="space-y-4">\s*\{result\.freshnessStatus === "stale"/u,
  );
});

test("dates the absence with the collector's verified last successful read", async () => {
  const source = await readSource();

  assert.match(source, /\{result\.lastSuccessfulUpdate \? \(/u);
  assert.match(
    source,
    /<Timestamp locale=\{localeTag\} value=\{result\.lastSuccessfulUpdate\} \/>/u,
  );
  assert.match(source, /\{translations\.checkedAt\}/u);
  // No clock fallback: an undated absence stays undated.
  assert.doesNotMatch(source, /new Date\(\)/u);
  assert.doesNotMatch(source, /Date\.now\(\)/u);
});

test("stops repeating the H1 as the empty-state heading", async () => {
  const source = await readSource();

  assert.match(source, /title=\{translations\.emptyTitle\}/u);
  assert.match(source, /description=\{translations\.empty\}/u);
  // The H1 still uses translations.title; only the empty card's heading changed.
  assert.match(
    source,
    /<SectionTitle as="h1" id="power-outages-heading" title=\{translations\.title\} \/>/u,
  );
  assert.doesNotMatch(source, /<EmptyState[\s\S]{0,120}title=\{translations\.title\}/u);
});

test("leaves CEDIS states intact and places discovery after their useful content", async () => {
  const source = await readSource();

  assert.match(
    source,
    /<ErrorState description=\{translations\.unavailable\} title=\{translations\.title\} \/>/u,
  );
  assert.match(source, /const summary =\n?\s*result\.status === "available"/u);
  assert.match(source, /groupPowerOutagesByDate\(result\.outages\)/u);
  assert.match(
    source,
    /<PowerOutageCard alert=\{outage\} city=\{city\} key=\{outage\.id\} locale=\{locale\} \/>/u,
  );
  assert.match(source, /<CityFeatureDiscovery city=\{city\} currentFeature="electricity" \/>/u);
  assert.doesNotMatch(source, /ExploreCityLinks/u);
  assert.ok(
    source.indexOf('<CityFeatureDiscovery city={city} currentFeature="electricity" />') >
      source.indexOf('result.status === "unavailable"'),
  );
});

test("adds no new links, routes or fabricated source facts", async () => {
  const source = await readSource();

  // No invented CEDIS deep link on a page with no outage to attribute it to.
  assert.doesNotMatch(source, /cedis\.me/u);
  assert.doesNotMatch(source, /getElectricityPath|href="\//u);
});

// CEDIS never exposes a publication time. `publishedAt` on a power alert is the scheduled outage
// day, renamed from `scheduledDay` in cedis-planned-outages.ts, anchored at 12:00 UTC — which is
// why the card used to read "Objavljeno: 4. 8. 2026. 14:00" for an outage scheduled that day.
test("no longer labels the scheduled outage day as a publication time", async () => {
  const source = await readSource();

  assert.doesNotMatch(source, /publicationTime/u);
  assert.doesNotMatch(source, /value=\{alert\.publishedAt\}/u);
  assert.doesNotMatch(source, /alert\.publishedAt/u);
});

test("keeps the scheduled date and time in their intended places", async () => {
  const source = await readSource();

  // The day heading and the explicit start–end range both remain; the removed row was redundant
  // with them, so nothing replaced it.
  assert.match(source, /\{translations\.scheduledTime\}: \{time\}/u);
  assert.match(source, /formatOptions: \{ dateStyle: "full", timeStyle: undefined \}/u);
  assert.match(source, /\[alert\.startsAt, alert\.expectedEndAt\]/u);
  assert.match(source, /\{translations\.source\}/u);
  assert.match(source, /\{translations\.officialSource\}/u);
});

test("derives no substitute timestamp from the collector or the clock", async () => {
  const source = await readSource();

  // Nothing was swapped in for the removed row.
  assert.doesNotMatch(source, /fetchedAt/u);
  assert.doesNotMatch(source, /Date\.now\(\)/u);
  assert.doesNotMatch(source, /new Date\(\)/u);
  // The one remaining Timestamp is the empty state's verified last successful read.
  assert.equal(source.match(/<Timestamp/gu)?.length, 1);
  assert.match(
    source,
    /<Timestamp locale=\{localeTag\} value=\{result\.lastSuccessfulUpdate\} \/>/u,
  );
});
