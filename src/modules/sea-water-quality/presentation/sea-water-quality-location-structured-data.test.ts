import assert from "node:assert/strict";
import test from "node:test";

import { getCity } from "@/shared/config/cities";

import {
  createSeaWaterQualityLocationBreadcrumbStructuredData,
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
