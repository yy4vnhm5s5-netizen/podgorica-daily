import assert from "node:assert/strict";
import test from "node:test";

import { parseEnvironment } from "./env.ts";

test("parses Event Quality defaults, boundaries, and valid overrides", () => {
  const defaults = parseEnvironment({});
  assert.equal(defaults.EVENT_QUALITY_MAX_PAST_DAYS, 30);
  assert.equal(defaults.EVENT_QUALITY_COUNT_DROP_RATIO, 0.5);
  const values = parseEnvironment({
    EVENT_QUALITY_MAX_PAST_DAYS: "1",
    EVENT_QUALITY_MAX_FUTURE_DAYS: "2",
    EVENT_QUALITY_MIN_SCORE: "100",
    EVENT_QUALITY_COUNT_DROP_RATIO: "1",
    EVENT_QUALITY_DEGRADED_WARNING_RATE: "0",
    EVENT_QUALITY_FAILING_REJECTION_RATE: "1",
    EVENT_QUALITY_WARN_MISSING_DESCRIPTION: "false",
    EVENT_QUALITY_WARN_MISSING_START_TIME: "false",
    EVENT_QUALITY_WARN_MISSING_VENUE: "false",
  });
  assert.equal(values.EVENT_QUALITY_MIN_SCORE, 100);
  assert.equal(values.EVENT_QUALITY_WARN_MISSING_VENUE, "false");
});

test("rejects invalid Event Quality numeric, ratio, and boolean values", () => {
  for (const value of [
    { EVENT_QUALITY_MAX_PAST_DAYS: "-1" },
    { EVENT_QUALITY_MAX_FUTURE_DAYS: "x" },
    { EVENT_QUALITY_MIN_SCORE: "-1" },
    { EVENT_QUALITY_MIN_SCORE: "101" },
    { EVENT_QUALITY_COUNT_DROP_RATIO: "-0.1" },
    { EVENT_QUALITY_COUNT_DROP_RATIO: "1.1" },
    { EVENT_QUALITY_WARN_MISSING_DESCRIPTION: "yes" },
    { EVENT_QUALITY_WARN_MISSING_VENUE: "" },
  ])
    assert.throws(() => parseEnvironment(value));
});
