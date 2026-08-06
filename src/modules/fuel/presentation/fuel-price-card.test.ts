import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { fuelProductIds, fuelProductNames } from "../domain/fuel-price.ts";
import { getFuelCardLabel } from "./fuel-card-label.ts";

const pageSource = async () => readFile(new URL("./fuel-prices-page.tsx", import.meta.url), "utf8");

// The card markup only: assertions below must not be satisfied by the history table or the chart.
const cardSource = async () => {
  const source = await pageSource();
  const start = source.indexOf("function FuelPriceCard(");
  assert.notEqual(start, -1, "FuelPriceCard must exist");
  return source.slice(start);
};

const localeTag = "sr-Latn-ME";

test("a card names its product, price and unit for a screen reader", () => {
  assert.equal(
    getFuelCardLabel("eurosuper95", 175, localeTag, {
      cents: 2,
      direction: "decrease",
      source: "official",
    }),
    "Eurosuper 95, cijena 1,75 eura po litru, promjena smanjenje 0,02 eura",
  );
});

test("the accessible name states the direction in words, not by colour", () => {
  const increase = getFuelCardLabel("eurodiesel", 185, localeTag, {
    cents: 6,
    direction: "increase",
    source: "official",
  });
  const unchanged = getFuelCardLabel("eurosuper98", 179, localeTag, {
    cents: 0,
    direction: "unchanged",
    source: "official",
  });

  assert.equal(increase, "Eurodizel, cijena 1,85 eura po litru, promjena povećanje 0,06 eura");
  assert.equal(unchanged, "Eurosuper 98, cijena 1,79 eura po litru, bez promjene");
});

test("a card with no comparable calculation claims no change at all", () => {
  assert.equal(
    getFuelCardLabel("heatingOil", 180, localeTag, undefined),
    "Lož ulje, cijena 1,80 eura po litru",
  );
});

test("all four products render as cards, from the domain list", async () => {
  const source = await pageSource();

  assert.equal(fuelProductIds.length, 4);
  // Generated from the domain order, so a product can never be dropped or hard-coded twice.
  assert.match(source, /fuelProductIds\.map\(\(productId\) => \{/u);
  assert.match(source, /<FuelPriceCard/u);
});

test("each card is a group with its own accessible name", async () => {
  const card = await cardSource();

  assert.match(card, /role="group"/u);
  const label = /aria-label=\{getFuelCardLabel\(([^)]*)\)\}/u.exec(card);
  assert.deepEqual(label?.[1], "productId, priceCents, localeTag, change");
});

test("no fuel or droplet icon is rendered inside a card", async () => {
  const source = await pageSource();
  const card = await cardSource();

  // The product name is the identifier now; the decorative glyph is gone, imports included.
  assert.doesNotMatch(card, /<(?:Fuel|Droplet|ProductIcon)\b/u);
  assert.doesNotMatch(source, /\bDroplet\b/u);
  assert.doesNotMatch(source, /fuelCardIcons/u);
});

test("the only icon left in a card is the change indicator, and it stays decorative", async () => {
  const card = await cardSource();

  const icons = [...card.matchAll(/<(ChangeIcon)\b([^>]*)>/gu)];
  assert.equal(icons.length, 1);
  for (const [, name, attributes] of icons) {
    assert.match(attributes, /aria-hidden="true"/u, `${name} must be hidden from assistive tech`);
  }
});

test("the page heading keeps its own fuel icon", async () => {
  const source = await pageSource();

  // Only the cards lost their icons: the H1 mark is untouched.
  assert.match(source, /icon=\{Fuel\}/u);
  assert.match(source, /id="gorivo-heading"/u);
});

test("the product name is uppercased by styling, not by rewriting the official name", async () => {
  const card = await cardSource();
  const source = await pageSource();

  const [, nameClasses] = /className=\{cn\("([^"]*)", accent\.name\)\}/u.exec(card) ?? [];
  assert.ok(nameClasses, "the product name must carry its own class list");
  assert.match(nameClasses, /\buppercase\b/u);
  assert.match(nameClasses, /\bfont-bold\b/u);
  // The domain names keep their official casing, so the accessible label is unaffected.
  assert.doesNotMatch(source, /toUpperCase/u);
  assert.match(card, /\{fuelProductNames\[productId\]\}/u);
});

test("each fuel has its own accent, and no two share one", async () => {
  const source = await pageSource();

  const [, accents] = /const fuelCardAccents[\s\S]*?= \{([\s\S]*?)\n\};/u.exec(source) ?? [];
  assert.ok(accents);

  const families = [...accents.matchAll(/from-([a-z]+)-50/gu)].map(([, family]) => family);
  assert.equal(families.length, fuelProductIds.length);
  assert.equal(new Set(families).size, fuelProductIds.length, "accents must be distinct");
  // A top border and a gradient tint per product, as the design specifies.
  assert.equal([...accents.matchAll(/border-t-2 border-t-[a-z]+-500/gu)].length, 4);
  // Identity covers the surface and the icon only — the change badge is not its business.
  const accentKeys = [...accents.matchAll(/^\s*(\w+):/gmu)].map(([, key]) => key);
  assert.deepEqual(
    [...new Set(accentKeys)].sort(),
    ["eurodiesel", "eurosuper95", "eurosuper98", "heatingOil", "name", "surface"],
  );
  // Each identity now colours the product name, one distinct family each.
  const nameTones = [...accents.matchAll(/name: "text-([a-z]+)-700"/gu)].map(([, tone]) => tone);
  assert.deepEqual(nameTones.sort(), ["amber", "blue", "emerald", "violet"]);
});

test("accent classes are written out, never composed at runtime", async () => {
  // Comments explaining the rule must not be mistaken for a violation of it.
  const code = (await pageSource()).replace(/\/\/[^\n]*/gu, "");

  // Tailwind only emits classes it can see; a template-built class name would render unstyled.
  assert.doesNotMatch(code, /(?:bg|text|border|from|to)-\$\{/u);
});

test("the change badge is coloured by direction, never by fuel identity", async () => {
  const source = await pageSource();

  const [, badges] = /const changeBadges[\s\S]*?= \{([\s\S]*?)\n\};/u.exec(source) ?? [];
  assert.ok(badges);
  // A rise must never read as good news just because that fuel's identity colour is green.
  assert.match(badges, /increase: "bg-red-50 text-red-700"/u);
  assert.match(badges, /decrease: "bg-emerald-50 text-emerald-700"/u);
  assert.match(badges, /unchanged: "bg-slate-100 text-slate-700"/u);

  // Blue and violet are identity-only families: they must not reach the badge at all.
  assert.doesNotMatch(badges, /blue|violet|amber/u);
  const [, accents] = /const fuelCardAccents[\s\S]*?= \{([\s\S]*?)\n\};/u.exec(source) ?? [];
  assert.ok(accents);
  assert.doesNotMatch(accents, /badge/u);
});

test("the badge icon and the amount share one semantic state", async () => {
  const card = await cardSource();
  const source = await pageSource();

  // One lookup keyed on direction drives the tint, and the same direction drives the icon.
  assert.match(card, /changeBadges\[change\.direction\]/u);
  assert.match(card, /changeIcons\[change\.direction\]/u);
  assert.doesNotMatch(card, /accent\.badge/u);

  const [, icons] = /const changeIcons[\s\S]*?= \{([\s\S]*?)\n\};/u.exec(source) ?? [];
  assert.ok(icons);
  assert.match(icons, /decrease: TrendingDown/u);
  assert.match(icons, /increase: TrendingUp/u);
  assert.match(icons, /unchanged: Minus/u);
});

test("the full official product name is rendered, never a shortened one", async () => {
  const card = await cardSource();

  // The card prints the domain name verbatim; nothing rewrites or abbreviates it on the way out.
  assert.match(card, /\{fuelProductNames\[productId\]\}/u);
  assert.deepEqual(
    fuelProductIds.map((productId) => fuelProductNames[productId]),
    ["Eurosuper 95", "Eurosuper 98", "Eurodizel", "Lož ulje"],
  );
  // "Eurosuper 95" and "Eurosuper 98" are the two that were being cut to "Eurosupe…".
  for (const name of ["Eurosuper 95", "Eurosuper 98"]) {
    assert.equal(Object.values(fuelProductNames).includes(name), true);
  }
});

test("nothing in the card can truncate or clamp the product name", async () => {
  const card = await cardSource();

  for (const shortener of [
    /\btruncate\b/u,
    /\btext-ellipsis\b/u,
    /\bline-clamp-\d/u,
    /\boverflow-hidden\b/u,
    /\btext-clip\b/u,
  ]) {
    assert.doesNotMatch(card, shortener, `card must not apply ${String(shortener)} to its content`);
  }
  // The name stands alone in its own element, so the change badge cannot squeeze it.
  const namePattern = /<p className=\{cn\([^}]*accent\.name\)\}>([\s\S]*?)<\/p>/u;
  const [, nameElement] = namePattern.exec(card) ?? [];
  assert.ok(nameElement);
  assert.match(nameElement, /\{fuelProductNames\[productId\]\}/u);
  assert.doesNotMatch(nameElement, /changeBadges|ChangeIcon/u);
});

test("the price, unit and hint are in the card, with figures aligned", async () => {
  const card = await cardSource();

  assert.match(card, /tabular-nums/u);
  assert.match(card, /€\/l/u);
  assert.match(card, /\{copy\.lastPrice\}/u);
  assert.match(await pageSource(), /lastPrice: "Posljednja cijena"/u);
});

test("the card grid is one column, then two, then four", async () => {
  const source = await pageSource();

  const gridPattern = /aria-label=\{copy\.currentHeading\}\s*\n\s*className="([^"]*)"/u;
  const [, grid] = gridPattern.exec(source) ?? [];
  assert.ok(grid);
  assert.match(grid, /\bgrid\b/u);
  assert.match(grid, /sm:grid-cols-2/u);
  assert.match(grid, /lg:grid-cols-4/u);
  // No `grid-cols-*` base class: one column is the unprefixed default.
  assert.doesNotMatch(grid, /(?<![a-z:])grid-cols-/u);
});

test("the cards stay server-rendered", async () => {
  assert.doesNotMatch(await pageSource(), /"use client"/u);
});
