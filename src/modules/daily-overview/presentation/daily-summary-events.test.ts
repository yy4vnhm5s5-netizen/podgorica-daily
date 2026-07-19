import assert from "node:assert/strict";
import test from "node:test";

import { getDailyEventsSummary } from "./daily-summary-events.ts";

test("keeps a verified zero event count distinct from unavailable data", () => {
  assert.deepEqual(getDailyEventsSummary(0), { count: 0, status: "available" });
  assert.deepEqual(getDailyEventsSummary(3), { count: 3, status: "available" });
  assert.deepEqual(getDailyEventsSummary(undefined), { status: "unavailable" });
});
