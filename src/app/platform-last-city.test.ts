import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { getStoredActiveCityId } from "./platform-last-city-state.ts";

test("accepts only a current active city as the stored last-city preference", () => {
  assert.equal(getStoredActiveCityId("podgorica", ["budva", "podgorica"]), "podgorica");
  assert.equal(getStoredActiveCityId("budva", ["budva", "podgorica"]), "budva");
  assert.equal(getStoredActiveCityId("removed-city", ["budva", "podgorica"]), undefined);
  assert.equal(getStoredActiveCityId(null, ["budva", "podgorica"]), undefined);
});

test("renders the continuation only for a valid stored city and uses the corrected label", async () => {
  const source = await readFile(new URL("./platform-last-city.tsx", import.meta.url), "utf8");

  assert.match(source, /if \(cards\.length < 2 \|\| !cityId\) return null/u);
  assert.match(source, /Nastavite gdje ste stali/u);
  assert.doesNotMatch(source, /Nastavi gdje ste stali/u);
  assert.match(source, /flex flex-wrap items-center justify-between/u);
  assert.match(source, /px-4 py-2\.5/u);
});
