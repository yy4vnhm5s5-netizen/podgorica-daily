import assert from "node:assert/strict";
import test from "node:test";

import { getDailyEventsSummary } from "./daily-summary-events.ts";

test("prioritizes a verified count of today's events", () => {
  assert.deepEqual(
    getDailyEventsSummary({ isUnavailable: false, todayCount: 2, upcomingCount: 3 }),
    { count: 2, status: "today" },
  );
});

test("distinguishes upcoming, valid empty, and unavailable event data", () => {
  assert.deepEqual(
    getDailyEventsSummary({ isUnavailable: false, todayCount: 0, upcomingCount: 6 }),
    { count: 6, status: "upcoming" },
  );
  assert.deepEqual(
    getDailyEventsSummary({ isUnavailable: true, todayCount: 0, upcomingCount: 6 }),
    { count: 6, status: "upcoming" },
  );
  assert.deepEqual(
    getDailyEventsSummary({ isUnavailable: false, todayCount: 0, upcomingCount: 0 }),
    { status: "empty" },
  );
  assert.deepEqual(
    getDailyEventsSummary({ isUnavailable: true, todayCount: 0, upcomingCount: 0 }),
    { status: "unavailable" },
  );
});
