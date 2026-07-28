import assert from "node:assert/strict";
import test from "node:test";

import { createCityContext } from "@/shared/config/cities";
import { getCityAlertServiceIds } from "./city-alert-service-capabilities.ts";

test("exposes only services backed by the current city's capabilities", () => {
  assert.deepEqual(getCityAlertServiceIds(createCityContext("podgorica").city), ["power", "water"]);
  assert.deepEqual(getCityAlertServiceIds(createCityContext("budva").city), ["power"]);
  // Tivat has electricity but, like Budva, no approved water-notice provider — must not expose
  // "water" just because a third city exists.
  assert.deepEqual(getCityAlertServiceIds(createCityContext("tivat").city), ["power"]);
});
