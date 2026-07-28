import assert from "node:assert/strict";
import test from "node:test";

import { canReadBudvaSeaWaterQuality, getBudvaSeaWaterQuality } from "./get-budva-sea-water-quality.ts";
import { createCityContext } from "@/shared/config/cities";

test("does not read the sea water quality cache for a city without the capability", async () => {
  const podgorica = createCityContext("podgorica");

  assert.equal(canReadBudvaSeaWaterQuality(podgorica), false);
  const result = await getBudvaSeaWaterQuality(podgorica);
  assert.deepEqual(result, { state: "unavailable" });
});

test("allows the sea water quality cache only for Budva", () => {
  const budva = createCityContext("budva");
  assert.equal(canReadBudvaSeaWaterQuality(budva), true);
});
