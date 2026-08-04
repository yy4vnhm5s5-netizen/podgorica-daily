import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  getSeaWaterQualityAdvertisingDescription,
  seaWaterQualityAdvertisingCta,
  seaWaterQualityAdvertisingLabel,
  seaWaterQualityAdvertisingTitle,
} from "./sea-water-quality-advertising.ts";
import { getActiveCities, getCity } from "@/shared/config/cities";

const detail = new URL("./sea-water-quality-location-page.tsx", import.meta.url);
const listing = new URL("./sea-water-quality-page.tsx", import.meta.url);

test("uses the registry's city form, never a hardcoded one", () => {
  const bar = getCity("bar");
  assert.ok(bar);

  assert.match(
    getSeaWaterQualityAdvertisingDescription(bar, "listing"),
    /plaže u Baru\.$/u,
  );
  for (const city of getActiveCities()) {
    const copy = getSeaWaterQualityAdvertisingDescription(city, "listing");
    assert.doesNotMatch(copy, new RegExp(`plaže u ${city.name}\\.`, "u"), city.id);
  }
});

test("names several kinds of local business, never one exclusively", () => {
  const podgorica = getCity("podgorica");
  assert.ok(podgorica);
  const copy = getSeaWaterQualityAdvertisingDescription(podgorica, "detail");

  for (const offer of ["restoran", "beach bar", "smještaj", "drugu lokalnu ponudu"]) {
    assert.ok(copy.includes(offer), offer);
  }
  assert.equal(
    copy,
    "Predstavite svoj restoran, beach bar, smještaj ili drugu lokalnu ponudu posjetiocima " +
      "koji provjeravaju ovo kupalište.",
  );
});

test("makes no claim about water quality, JPMD or the reader", () => {
  const budva = getCity("budva");
  assert.ok(budva);
  const copies = [
    getSeaWaterQualityAdvertisingDescription(budva, "detail"),
    getSeaWaterQualityAdvertisingDescription(budva, "listing"),
    seaWaterQualityAdvertisingTitle,
  ];

  for (const copy of copies) {
    assert.doesNotMatch(copy, /JPMD|Morsko dobro|kvalitet|odlična|čist|preporuč|najbolj/iu, copy);
  }
});

test("both beach surfaces render exactly one clearly-labelled banner", async () => {
  for (const [name, url] of [
    ["detail", detail],
    ["listing", listing],
  ] as const) {
    const source = await readFile(url, "utf8");

    assert.equal(source.match(/<AdvertisingCard/gu)?.length, 1, name);
    assert.match(source, /label=\{seaWaterQualityAdvertisingLabel\}/u, name);
    assert.match(source, /title=\{seaWaterQualityAdvertisingTitle\}/u, name);
    assert.match(source, /subtitle=\{seaWaterQualityAdvertisingCta\}/u, name);
    // The approved existing destination, not a new route and not a mailto.
    assert.match(source, /href=\{getContactPath\(\)\}/u, name);
    assert.doesNotMatch(source, /mailto:/u, name);
  }
  assert.equal(seaWaterQualityAdvertisingLabel, "Oglas");
  assert.equal(seaWaterQualityAdvertisingCta, "Kontaktirajte nas →");
});

test("the detail banner sits after the summary and before the history", async () => {
  const source = await readFile(detail, "utf8");
  const at = (needle: string) => source.indexOf(needle);

  assert.ok(at("Najnoviji rezultat") < at("Sažetak mjerenja"));
  assert.ok(at("Sažetak mjerenja") < at("<AdvertisingCard"));
  assert.ok(at("<AdvertisingCard") < at("Istorija uzorkovanja"));
  assert.ok(at("Istorija uzorkovanja") < at("Druga mjerna mjesta na istoj plaži"));
  assert.ok(at("Druga mjerna mjesta na istoj plaži") < at("<ExploreCityLinks"));
});

test("the listing banner sits after the overview and before the beach table", async () => {
  const source = await readFile(listing, "utf8");
  const at = (needle: string) => source.indexOf(needle);

  assert.ok(at("plaze-pregled-heading") < at("<AdvertisingCard"));
  assert.ok(at("<AdvertisingCard") < at("plaze-tabela-heading"));
});

test("introduces no ad network, tracking, cookie or client fetch", async () => {
  const advertising = new URL("./sea-water-quality-advertising.ts", import.meta.url);
  for (const url of [detail, listing, advertising]) {
    const source = await readFile(url, "utf8");

    for (const banned of [
      /googlesyndication|doubleclick|adsbygoogle|adservice/iu,
      /document\.cookie|localStorage|navigator\.geolocation/u,
      /"use client"/u,
      /fetch\(|useEffect/u,
      /<script/u,
    ]) {
      assert.doesNotMatch(source, banned, String(banned));
    }
  }
});

test("leaves the beach pages' existing content and structure intact", async () => {
  const source = await readFile(detail, "utf8");

  assert.match(
    source,
    /title=\{`\$\{location\.displayName\}, \$\{city\.name\} — kvalitet mora`\}/u,
  );
  assert.match(source, /const beachName = getDistinctBeachName\(location\);/u);
  assert.match(source, /getSeaWaterQualityLocationBreadcrumbTrail\(\{/u);
  assert.match(source, /const summary = getSeaWaterQualityLocationSummary\(location\);/u);
  assert.match(source, /getRelatedSeaWaterQualityLocations\(history, location\)/u);
  assert.match(source, /<ExploreCityLinks city=\{city\} exclude=\{\["seaWaterQuality"\]\} \/>/u);
  // No structured data was added by this pass.
  assert.doesNotMatch(source, /application\/ld\+json/u);
});
