import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { fuelProductIds, fuelProductNames } from "@/modules/fuel/domain/fuel-price";
import { getFuelPricesPath } from "@/shared/config/public-routes";

const read = async (file: string) => readFile(new URL(file, import.meta.url), "utf8");

test("the standalone city list is gone, with no empty wrapper left behind", async () => {
  const homepage = await read("./platform-homepage.tsx");

  assert.doesNotMatch(homepage, /Svi gradovi/u);
  assert.doesNotMatch(homepage, /PlatformCityIndex/u);
  // The city section ends with the selector; nothing hollow follows it.
  assert.match(homepage, /<PlatformCitySelector cards=\{cards\} \/>\s*<\/section>/u);
});

test("the city selector and its rich panel are untouched", async () => {
  const homepage = await read("./platform-homepage.tsx");
  const selector = await read("./platform-city-selector.tsx");

  assert.match(homepage, /<PlatformCitySelector cards=\{cards\} \/>/u);
  assert.match(homepage, /<LastCityContinuation cards=\{cards\} \/>/u);
  // Tabs are still real links with tab semantics and the progressive-enhancement guard.
  assert.match(selector, /href=\{card\.href\}/u);
  assert.match(selector, /role="tab"/u);
  assert.match(selector, /aria-selected=\{isSelected\}/u);
  assert.match(selector, /<CityCard card=\{activeCard\} \/>/u);
});

test("the fuel section is a neutral information card, not a promotional banner", async () => {
  const fuel = await read("./platform-fuel-summary.tsx");

  assert.match(fuel, /Cijene goriva<\/p>/u);
  assert.doesNotMatch(fuel, /Cijela Crna Gora/iu);
  // The specific regression being guarded: no amber container, border or gradient.
  assert.doesNotMatch(fuel, /amber/u);
  assert.doesNotMatch(fuel, /bg-gradient-to/u);
  assert.match(fuel, /rounded-xl border border-border bg-background/u);
});

test("the fuel heading, supporting sentence and CTA are kept", async () => {
  const fuel = await read("./platform-fuel-summary.tsx");

  assert.match(fuel, /Cijene goriva u Crnoj Gori/u);
  const supporting =
    /Zvanične maksimalne maloprodajne cijene naftnih derivata, sa datumom važenja\./u;
  assert.match(fuel, supporting);
  assert.match(fuel, /Pogledaj cijene goriva/u);
});

test("the CTA is a crawlable link built from the route helper", async () => {
  const fuel = await read("./platform-fuel-summary.tsx");

  assert.match(fuel, /href=\{getFuelPricesPath\(\)\}/u);
  assert.doesNotMatch(fuel, /href="\/gorivo"/u);
  assert.equal(getFuelPricesPath(), "/gorivo");
});

test("all four products come from the fuel domain, never from local literals", async () => {
  const fuel = await read("./platform-fuel-summary.tsx");

  assert.deepEqual(
    fuelProductIds.map((productId) => fuelProductNames[productId]),
    ["Eurosuper 95", "Eurosuper 98", "Eurodizel", "Lož ulje"],
  );
  assert.match(fuel, /fuelProductIds\.flatMap/u);
  assert.match(fuel, /fuelProductNames\[productId\]/u);
  // No parallel naming, and no hardcoded product labels.
  assert.doesNotMatch(fuel, /BMB/u);
  for (const name of ["Eurosuper 95", "Eurosuper 98", "Eurodizel", "Lož ulje"])
    assert.doesNotMatch(fuel, new RegExp(`"${name}"`, "u"));
});

test("prices are read from the snapshot and formatted by the shared helper", async () => {
  const fuel = await read("./platform-fuel-summary.tsx");

  assert.match(fuel, /current\.prices\.find/u);
  assert.match(fuel, /formatFuelPriceWithUnit\(priceCents, localeTag\)/u);
  // The unit string itself is not re-spelled here.
  assert.doesNotMatch(fuel, /€ \/ L/u);
  assert.doesNotMatch(fuel, /\d,\d\d/u);
});

test("the homepage reads the same cached snapshot /gorivo reads", async () => {
  const route = await read("./page.tsx");

  assert.match(route, /getFuelPrices\(\)/u);
  assert.match(route, /from "@\/modules\/fuel\/infrastructure\/gov-me-fuel-prices"/u);
  // No second endpoint, no collector, no client fetching.
  assert.doesNotMatch(route, /refreshFuelPrices|runFuelPricesCollector|fetch\(/u);
});

test("an unusable snapshot omits the prices instead of inventing them", async () => {
  const fuel = await read("./platform-fuel-summary.tsx");

  assert.match(fuel, /result\.freshnessStatus === "unavailable" \|\| !current\s*\?\s*\[\]/u);
  // The row is conditional; the heading and CTA are not.
  assert.match(fuel, /\{prices\.length > 0 \? \(/u);
  assert.doesNotMatch(fuel, /N\/A|0,00|"—"/u);
});

test("the fuel section stays server-rendered", async () => {
  const fuel = await read("./platform-fuel-summary.tsx");
  const homepage = await read("./platform-homepage.tsx");

  assert.doesNotMatch(fuel, /"use client"/u);
  assert.doesNotMatch(homepage, /"use client"/u);
  assert.doesNotMatch(fuel, /useState|useEffect/u);
});

test("the homepage section order is city block, fuel, then supporting content", async () => {
  const homepage = await read("./platform-homepage.tsx");
  const order = [...homepage.matchAll(/aria-labelledby="([a-z-]+)"/gu)].map(([, id]) => id);

  assert.deepEqual(order, [
    "platform-homepage-title",
    "cities-heading",
    "fuel-heading",
    "how-it-works-heading",
    "faq-heading",
  ]);
});
