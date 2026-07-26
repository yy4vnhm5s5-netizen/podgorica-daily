import assert from "node:assert/strict";
import test from "node:test";

import { getStoredActiveCityId } from "./platform-last-city-state.ts";

test("accepts only a current active city as the stored last-city preference", () => {
  assert.equal(getStoredActiveCityId("podgorica", ["budva", "podgorica"]), "podgorica");
  assert.equal(getStoredActiveCityId("budva", ["budva", "podgorica"]), "budva");
  assert.equal(getStoredActiveCityId("removed-city", ["budva", "podgorica"]), undefined);
  assert.equal(getStoredActiveCityId(null, ["budva", "podgorica"]), undefined);
});
