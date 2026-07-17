import assert from "node:assert/strict";
import test from "node:test";

import {
  deriveEventProviderHealth,
  toEventProviderStatusReadModel,
} from "./event-provider-status.ts";

const thresholds = { degradedWarningRate: 0.4, failingRejectionRate: 0.5 };
const result = { events: [], parserWarnings: [], state: "fresh" as const, venues: [] };
const input = (overrides = {}) => ({
  enabled: true,
  providerId: "kic",
  providerName: "KIC",
  result,
  ...overrides,
});

test("derives health with deterministic precedence and threshold boundaries", () => {
  assert.equal(
    deriveEventProviderHealth(
      input({ enabled: false, result: { ...result, state: "unavailable" } }),
      thresholds,
    ),
    "disabled",
  );
  assert.equal(
    deriveEventProviderHealth(input({ result: { ...result, state: "unavailable" } }), thresholds),
    "unavailable",
  );
  assert.equal(
    deriveEventProviderHealth(input({ lastRefreshError: "failed" }), thresholds),
    "failing",
  );
  assert.equal(
    deriveEventProviderHealth(
      input({ diagnostics: { normalizedCount: 10, rejectedCount: 5 } }),
      thresholds,
    ),
    "failing",
  );
  assert.equal(
    deriveEventProviderHealth(input({ result: { ...result, state: "stale" } }), thresholds),
    "degraded",
  );
  assert.equal(
    deriveEventProviderHealth(
      input({ diagnostics: { normalizedCount: 10, acceptedWithWarningsCount: 4 } }),
      thresholds,
    ),
    "degraded",
  );
  assert.equal(deriveEventProviderHealth(input(), thresholds), "healthy");
});

test("maps safe admin status rates, ordering, and zero-result protection", () => {
  const mapped = toEventProviderStatusReadModel(
    input({
      diagnostics: {
        acceptedWithWarningsCount: 2,
        countDropWarning: true,
        finalEventCount: 0,
        normalizedCount: 4,
        previousSuccessfulEventCount: 8,
        rejectedCount: 1,
        rejectionCounts: { "missing-title": 1, "invalid-date": 1 },
        warningCounts: { "missing-venue": 2, "missing-description": 2 },
      },
      result: { ...result, lastRefreshError: "cache", parserWarnings: ["parser"] },
    }),
    thresholds,
  );
  assert.equal(mapped.rejectionRate, 0.25);
  assert.equal(mapped.warningRate, 0.5);
  assert.equal(mapped.zeroResultProtectionTriggered, true);
  assert.deepEqual(mapped.commonWarnings, [
    ["missing-description", 2],
    ["missing-venue", 2],
  ]);
  assert.equal(toEventProviderStatusReadModel(input(), thresholds).rejectionRate, 0);
});
