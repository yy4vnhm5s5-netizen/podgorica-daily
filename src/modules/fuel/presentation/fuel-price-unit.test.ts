import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { formatFuelPrice } from "../domain/fuel-price.ts";
import {
  formatFuelPriceWithUnit,
  formatFuelRangeWithUnit,
  fuelUnitLabel,
} from "./fuel-price-unit.ts";

const read = async (file: string) => readFile(new URL(file, import.meta.url), "utf8");

const localeTag = "sr-Latn-ME";

test("the per-litre unit is spaced, with an uppercase litre", () => {
  assert.equal(fuelUnitLabel, "€ / L");
});

test("a price keeps its formatting and gains the unit", () => {
  assert.equal(formatFuelPriceWithUnit(175, localeTag), "1,75 € / L");
  assert.equal(formatFuelPriceWithUnit(180, localeTag), "1,80 € / L");
  // The number itself is untouched: the unit is appended, never reformatted.
  assert.equal(formatFuelPriceWithUnit(175, localeTag).startsWith(formatFuelPrice(175)), true);
});

test("a range states both bounds and the unit once", () => {
  assert.equal(formatFuelRangeWithUnit(162, 175, localeTag), "1,62 – 1,75 € / L");
});

test("every per-litre value on the page uses the one unit label", async () => {
  const page = await read("./fuel-prices-page.tsx");
  const trend = await read("./fuel-price-trend.tsx");

  // Cards, both chart statistics and the tooltip all read from the shared module.
  assert.match(page, /\{fuelUnitLabel\}/u);
  assert.match(trend, /formatFuelPriceWithUnit\(latest\.priceCents, localeTag\)/u);
  assert.match(trend, /formatFuelRangeWithUnit\(minimum, maximum, localeTag\)/u);
  assert.match(trend, /\{fuelUnitLabel\}/u);
  // The cramped form is gone everywhere.
  assert.doesNotMatch(`${page}\n${trend}`, /€\/l/u);
});

test("plain euro amounts are left alone", async () => {
  const page = await read("./fuel-prices-page.tsx");
  const trend = await read("./fuel-price-trend.tsx");

  // A change value is an amount, not a rate: it stays "0,02 €" with no per-litre unit.
  assert.match(page, /\$\{formatFuelPrice\(change\.cents, localeTag\)\} €`/u);
  assert.match(trend, /\$\{formatFuelPrice\(change\.cents, localeTag\)\} €`/u);
});
