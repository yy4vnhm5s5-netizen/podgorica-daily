import assert from "node:assert/strict";
import test from "node:test";

import { getCity } from "@/shared/config/cities";

import {
  createSeaWaterQualityLocationBreadcrumbStructuredData,
  getSeaWaterQualityLocationBreadcrumbTrail,
  serializeSeaWaterQualityStructuredData,
} from "./sea-water-quality-location-structured-data.ts";

test("creates a fact-only breadcrumb for a canonical beach detail URL", () => {
  const city = getCity("budva");
  assert.ok(city);
  const data = createSeaWaterQualityLocationBreadcrumbStructuredData({
    city,
    locationName: "Jaz 01",
    slug: "jaz-01",
  });

  assert.deepEqual(
    data.itemListElement.map(({ item, name }) => ({ item, name })),
    [
      { item: "https://gradom.me/budva", name: "Budva" },
      { item: "https://gradom.me/budva/plaze", name: "Plaže i kvalitet mora" },
      { item: "https://gradom.me/budva/plaze/jaz-01", name: "Jaz 01" },
    ],
  );
  assert.doesNotMatch(serializeSeaWaterQualityStructuredData(data), /<script/u);
});

test("keeps the breadcrumb hierarchy city → beach listing → monitoring location", () => {
  const budva = getCity("budva");
  assert.ok(budva);

  const trail = getSeaWaterQualityLocationBreadcrumbTrail({
    city: budva,
    locationName: "Jaz 01",
    slug: "jaz-01",
  });

  assert.deepEqual(
    trail.map((step) => step.href),
    ["/budva", "/budva/plaze", "/budva/plaze/jaz-01"],
  );
  assert.deepEqual(
    trail.map((step) => step.name),
    ["Budva", "Plaže i kvalitet mora", "Jaz 01"],
  );
});

test("builds the BreadcrumbList from that same trail so the two cannot drift", () => {
  const budva = getCity("budva");
  assert.ok(budva);
  const input = { city: budva, locationName: "Jaz 01", slug: "jaz-01" };

  const trail = getSeaWaterQualityLocationBreadcrumbTrail(input);
  const structuredData = createSeaWaterQualityLocationBreadcrumbStructuredData(input);

  assert.deepEqual(
    structuredData.itemListElement.map((item) => [item.position, item.name, item.item]),
    trail.map((step, index) => [index + 1, step.name, step.url]),
  );
  // The intermediate parent is the beach listing, and the last crumb is the canonical detail URL.
  assert.equal(structuredData.itemListElement[1]?.item, "https://gradom.me/budva/plaze");
  assert.equal(structuredData.itemListElement[2]?.item, "https://gradom.me/budva/plaze/jaz-01");
});
