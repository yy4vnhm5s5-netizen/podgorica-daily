import assert from "node:assert/strict";
import test from "node:test";

import { parseEnvironment } from "./env.ts";

test("parses Event Quality defaults, boundaries, and valid overrides", () => {
  const defaults = parseEnvironment({});
  assert.equal(defaults.RUNTIME_DATA_DIR, ".runtime");
  assert.equal(defaults.CEDIS_CACHE_PATH, undefined);
  assert.equal(defaults.EVENT_QUALITY_MAX_PAST_DAYS, 30);
  assert.equal(defaults.EVENT_QUALITY_COUNT_DROP_RATIO, 0.5);
  assert.equal(defaults.CEDIS_CACHE_FRESHNESS_MINUTES, 420);
  assert.equal(defaults.CINEPLEXX_CACHE_FRESHNESS_MINUTES, 780);
  assert.equal(defaults.EVENT_CACHE_FRESHNESS_MINUTES, 240);
  assert.equal(defaults.GOING_OUT_CACHE_FRESHNESS_MINUTES, 240);
  assert.equal(defaults.PODGORICA_FLIGHTS_CACHE_FRESHNESS_MINUTES, 90);
  assert.equal(defaults.VIKPG_CACHE_FRESHNESS_MINUTES, 150);
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

test("validates each provider-specific refresh secret independently", () => {
  assert.throws(() => parseEnvironment({ FLIGHTS_REFRESH_SECRET: "too-short" }));
  const values = parseEnvironment({
    CEDIS_REFRESH_SECRET: "cedis-refresh-secret-at-least-32-characters",
    CINEPLEXX_REFRESH_SECRET: "cineplexx-refresh-secret-at-least-32-char",
    FLIGHTS_REFRESH_SECRET: "flights-refresh-secret-at-least-32-characters",
    GOING_OUT_REFRESH_SECRET: "going-out-refresh-secret-at-least-32-chars",
    STANDARD_EVENTS_REFRESH_SECRET: "standard-events-refresh-secret-at-least-32",
    VIKPG_REFRESH_SECRET: "vikpg-refresh-secret-at-least-32-characters",
    ZPCG_RAILWAY_REFRESH_SECRET: "zpcg-railway-refresh-secret-at-least-32",
  });
  assert.equal(values.CINEPLEXX_REFRESH_SECRET?.startsWith("cineplexx"), true);
});
