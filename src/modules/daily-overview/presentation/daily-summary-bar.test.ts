import assert from "node:assert/strict";
import test from "node:test";

import { getDailySummaryItemIds } from "./daily-summary-items.ts";

test("always includes weather and includes only publicly available summary modules", () => {
  assert.deepEqual(getDailySummaryItemIds({ cinema: true, events: true, goingOut: true }), [
    "weather",
    "goingOut",
    "events",
    "cinema",
  ]);
  assert.deepEqual(getDailySummaryItemIds({ cinema: false, events: false, goingOut: true }), [
    "weather",
    "goingOut",
  ]);
});
