import assert from "node:assert/strict";
import test from "node:test";

import { canReadRailwayDepartures, getRailwayDepartures } from "./get-railway-departures.ts";
import { createCityContext } from "@/shared/config/cities";

test("does not read the railway cache for a city without railway capability", async () => {
  const podgorica = createCityContext("podgorica");
  const context = { ...podgorica, city: { ...podgorica.city, capabilities: [] } };
  assert.equal(canReadRailwayDepartures(context), false);
  const result = await getRailwayDepartures(context);

  assert.deepEqual(result, { departures: [], state: "unavailable" });
});

test("allows the railway cache only for a city with railway capability", () => {
  const context = createCityContext("podgorica");
  assert.equal(canReadRailwayDepartures(context), true);
});
