import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  getSeaWaterQualityAdvertisingDescription,
  seaWaterQualityAdvertisingAriaLabel,
  seaWaterQualityAdvertisingCta,
  seaWaterQualityAdvertisingTitle,
} from "./sea-water-quality-advertising.ts";
import { getActiveCities, getCity } from "@/shared/config/cities";

const detail = new URL("./sea-water-quality-location-page.tsx", import.meta.url);
const listing = new URL("./sea-water-quality-page.tsx", import.meta.url);

test("uses the registry's city form, never a hardcoded one", () => {
  const bar = getCity("bar");
  assert.ok(bar);

  assert.match(getSeaWaterQualityAdvertisingDescription(bar, "listing"), /plaže u Baru\.$/u);
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

test("both beach surfaces render exactly one centred banner and no visible label chip", async () => {
  for (const [name, url] of [
    ["detail", detail],
    ["listing", listing],
  ] as const) {
    const source = await readFile(url, "utf8");

    assert.equal(source.match(/<AdvertisingCard/gu)?.length, 1, name);
    assert.match(source, /align="center"/u, name);
    assert.match(source, /ariaLabel=\{seaWaterQualityAdvertisingAriaLabel\}/u, name);
    assert.match(source, /title=\{seaWaterQualityAdvertisingTitle\}/u, name);
    assert.match(source, /subtitle=\{seaWaterQualityAdvertisingCta\}/u, name);
    // The approved existing destination, not a new route and not a mailto.
    assert.match(source, /href=\{getContactPath\(\)\}/u, name);
    assert.doesNotMatch(source, /mailto:/u, name);
    // The "Oglas" chip is gone; nothing replaced it visually.
    assert.doesNotMatch(source, /Oglas"|label=\{/u, name);
  }
  assert.equal(seaWaterQualityAdvertisingTitle, "Vaša reklama može biti ovdje");
  assert.equal(seaWaterQualityAdvertisingCta, "Kontaktirajte nas →");
});

test("states the promotional nature in the region's accessible name instead of a chip", async () => {
  const card = await readFile(
    new URL("../../../shared/components/dashboard/advertising-card.tsx", import.meta.url),
    "utf8",
  );

  assert.equal(
    seaWaterQualityAdvertisingAriaLabel,
    "Promotivni oglas: Vaša reklama može biti ovdje",
  );
  assert.match(card, /<aside aria-label=\{ariaLabel \?\? title\}/u);
  // No visible label chip remains in the component, and no text is hidden from assistive tech.
  assert.doesNotMatch(card, /uppercase tracking-wide text-indigo-700/u);
  assert.doesNotMatch(card, /aria-hidden="true">\{title\}|sr-only/u);
});

test("centres the icon, title, description and call to action", async () => {
  const card = await readFile(
    new URL("../../../shared/components/dashboard/advertising-card.tsx", import.meta.url),
    "utf8",
  );

  // One column, centred cross-axis, centred text — icon above title above description above CTA.
  assert.match(card, /isCentered\n?\s*\? "flex-col items-center text-center"/u);
  assert.match(card, /const isCentered = align === "center";/u);
  // The card chrome is untouched: same dashed border and colours.
  assert.match(card, /border border-dashed border-indigo-200\/80 bg-indigo-50\/40/u);
});

test("the city dashboard placement stays left-aligned and unchanged", async () => {
  const dashboard = await readFile(
    new URL("../../../app/city-dashboard.tsx", import.meta.url),
    "utf8",
  );
  const card = await readFile(
    new URL("../../../shared/components/dashboard/advertising-card.tsx", import.meta.url),
    "utf8",
  );

  // It passes no align prop, and the default keeps the original single-row layout.
  assert.doesNotMatch(dashboard, /align="center"/u);
  assert.match(dashboard, /<AdvertisingCard\n\s+href=\{getContactPath\(\)\}/u);
  assert.match(card, /align = "start"/u);
});

test("the detail banner sits after the summary and before the history", async () => {
  const source = await readFile(detail, "utf8");
  const at = (needle: string) => source.indexOf(needle);

  assert.ok(at("Najnoviji rezultat") < at("Sažetak mjerenja"));
  assert.ok(at("Sažetak mjerenja") < at("<AdvertisingCard"));
  assert.ok(at("<AdvertisingCard") < at("Istorija uzorkovanja"));
  assert.ok(at("Istorija uzorkovanja") < at("Druga mjerna mjesta na istoj plaži"));
  assert.ok(at("Druga mjerna mjesta na istoj plaži") < at("<CityFeatureDiscovery"));
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
  assert.match(source, /<CityFeatureDiscovery city=\{city\} currentFeature="seaWaterQuality" \/>/u);
  // No structured data was added by this pass.
  assert.doesNotMatch(source, /application\/ld\+json/u);
});
