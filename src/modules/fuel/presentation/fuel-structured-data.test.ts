import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  createFuelBreadcrumbStructuredData,
  serializeFuelStructuredData,
} from "./fuel-structured-data.ts";

const routeSource = async () =>
  readFile(new URL("../../../app/gorivo/page.tsx", import.meta.url), "utf8");

test("the page describes where it sits, and claims nothing else", () => {
  const data = createFuelBreadcrumbStructuredData();

  assert.equal(data["@type"], "BreadcrumbList");
  assert.equal(data["@context"], "https://schema.org");
  assert.deepEqual(
    data.itemListElement.map(({ name, position }) => [position, name]),
    [
      [1, "Početna"],
      [2, "Cijene goriva"],
    ],
  );
  assert.equal(data.itemListElement.at(-1)?.item, "https://gradom.me/gorivo");
});

test("the trail ends on the page's own canonical URL", async () => {
  const data = createFuelBreadcrumbStructuredData();
  const route = await routeSource();

  // The canonical the route declares and the last breadcrumb item must be the same URL.
  assert.match(route, /canonical: getFuelPricesPath\(\)/u);
  assert.equal(new URL(data.itemListElement[1].item).pathname, "/gorivo");
});

test("no commercial or governmental claim is made anywhere in the markup", () => {
  const serialized = serializeFuelStructuredData(createFuelBreadcrumbStructuredData());

  // Gradom neither sells fuel nor sets these prices, so none of these may ever appear.
  for (const forbidden of [
    "Product",
    "Offer",
    "AggregateOffer",
    "PriceSpecification",
    "GovernmentService",
    "Dataset",
    "provider",
    "seller",
    "price",
  ]) {
    assert.equal(serialized.includes(forbidden), false, `${forbidden} must not be asserted`);
  }
});

test("no date of any kind is embedded, so no timestamp can imply a content change", () => {
  const serialized = serializeFuelStructuredData(createFuelBreadcrumbStructuredData());

  // The collector's fetch time is not a content date, and nothing here needs one.
  assert.doesNotMatch(serialized, /date(?:Published|Modified)|temporalCoverage|fetchedAt/iu);
  assert.doesNotMatch(serialized, /\d{4}-\d{2}-\d{2}/u);
});

test("the payload is valid JSON with escaped angle brackets", () => {
  const serialized = serializeFuelStructuredData(createFuelBreadcrumbStructuredData());

  assert.deepEqual(JSON.parse(serialized), createFuelBreadcrumbStructuredData());
  assert.equal(serialized.includes("<"), false);
});

test("the route emits exactly one JSON-LD node, server-rendered", async () => {
  const route = await routeSource();

  assert.equal([...route.matchAll(/application\/ld\+json/gu)].length, 1);
  assert.match(route, /serializeFuelStructuredData\(createFuelBreadcrumbStructuredData\(\)\)/u);
  // No client boundary: the node is in the initial HTML.
  assert.doesNotMatch(route, /"use client"/u);
});
