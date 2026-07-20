import assert from "node:assert/strict";
import test from "node:test";

import { getRailwayStationDisplayState } from "./railway-station-ui-model.ts";

test("distinguishes valid empty, unavailable, fresh, and stale railway card states", () => {
  assert.equal(
    getRailwayStationDisplayState({ departureCount: 2, state: "fresh" }),
    "departures",
  );
  assert.equal(
    getRailwayStationDisplayState({ departureCount: 2, state: "stale" }),
    "stale",
  );
  assert.equal(
    getRailwayStationDisplayState({ departureCount: 0, state: "fresh" }),
    "empty",
  );
  assert.equal(
    getRailwayStationDisplayState({ departureCount: 0, state: "unavailable" }),
    "unavailable",
  );
});
