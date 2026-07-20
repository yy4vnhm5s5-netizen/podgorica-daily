import assert from "node:assert/strict";
import test from "node:test";

import {
  initializeCityAlertCaches,
  type CityAlertCacheProvider,
  type CityAlertCollectorSummary,
} from "./city-alerts-initialization.ts";

function collectorSummary(
  overrides: Partial<CityAlertCollectorSummary> = {},
): CityAlertCollectorSummary {
  return {
    alertCount: 0,
    cachePath: "/runtime/cache/provider.json",
    cacheStatus: "fresh",
    completedAt: "2026-07-20T08:00:00.000Z",
    retainedPreviousSnapshot: false,
    status: "success",
    warnings: [],
    ...overrides,
  };
}

function provider(overrides: Partial<CityAlertCacheProvider> = {}): CityAlertCacheProvider {
  return {
    cachePath: "/runtime/cache/provider.json",
    enabled: true,
    id: "CEDIS",
    readCache: async () => ({ snapshot: null }),
    refresh: async () => ({
      summary: collectorSummary(),
    }),
    ...overrides,
  };
}

test("preserves an existing cache and does not start a refresh", async () => {
  let refreshes = 0;
  const logs: string[] = [];
  const result = await initializeCityAlertCaches({
    ensureDirectory: async () => undefined,
    log: (message) => logs.push(message),
    providers: [
      provider({
        readCache: async () => ({
          snapshot: {
            alerts: [],
            freshnessStatus: "fresh",
            lastSuccessfulRefreshAt: "2026-07-19T08:00:00.000Z",
            source: "CEDIS",
          },
        }),
        refresh: async () => {
          refreshes += 1;
          throw new Error("must not refresh");
        },
      }),
    ],
  });

  assert.equal(refreshes, 0);
  assert.deepEqual(result.providers, [{ id: "CEDIS", state: "cache-found" }]);
  assert.ok(logs.includes("CEDIS: cache found at /runtime/cache/provider.json."));
});

test("refreshes an invalid cache shape instead of treating it as a provider snapshot", async () => {
  const logs: string[] = [];
  let refreshes = 0;
  await initializeCityAlertCaches({
    ensureDirectory: async () => undefined,
    log: (message) => logs.push(message),
    providers: [
      provider({
        readCache: async () => ({
          snapshot: {
            freshnessStatus: "fresh",
            lastSuccessfulRefreshAt: "2026-07-19T08:00:00.000Z",
            source: "CEDIS",
          },
        }),
        refresh: async () => {
          refreshes += 1;
          return {
            summary: collectorSummary(),
          };
        },
      }),
    ],
  });

  assert.equal(refreshes, 1);
  assert.ok(logs.includes("CEDIS: cache missing (cache-unusable); refresh started."));
});

test("refreshes an unavailable cache so a repaired provider can recreate it", async () => {
  const logs: string[] = [];
  let refreshes = 0;
  const result = await initializeCityAlertCaches({
    ensureDirectory: async () => undefined,
    log: (message) => logs.push(message),
    providers: [
      provider({
        id: "VIK",
        readCache: async () => ({
          snapshot: {
            alerts: [],
            freshnessStatus: "unavailable",
            lastSuccessfulRefreshAt: "not-a-date",
          },
        }),
        refresh: async () => {
          refreshes += 1;
          return {
            summary: collectorSummary(),
          };
        },
      }),
    ],
  });

  assert.equal(refreshes, 1);
  assert.deepEqual(result.providers, [{ alertCount: 0, id: "VIK", state: "refreshed" }]);
  assert.ok(logs.includes("VIK: cache missing (cache-unusable); refresh started."));
});

test("initializes a missing cache and logs the normalized result", async () => {
  const logs: string[] = [];
  const result = await initializeCityAlertCaches({
    ensureDirectory: async () => undefined,
    log: (message) => logs.push(message),
    providers: [
      provider({
        id: "VIK",
        refresh: async () => ({
          summary: collectorSummary({ alertCount: 2 }),
        }),
      }),
    ],
  });

  assert.deepEqual(result.providers, [{ alertCount: 2, id: "VIK", state: "refreshed" }]);
  assert.ok(logs.includes("VIK: cache missing; refresh started."));
  assert.ok(logs.includes("VIK: refresh completed successfully with 2 alert(s)."));
});

test("logs a successful zero-alert refresh separately from a retained cache", async () => {
  const logs: string[] = [];
  await initializeCityAlertCaches({
    ensureDirectory: async () => undefined,
    log: (message) => logs.push(message),
    providers: [
      provider({
        refresh: async () => ({
          summary: collectorSummary(),
        }),
      }),
      provider({
        id: "VIK",
        refresh: async () => ({
          summary: collectorSummary({
            alertCount: 3,
            retainedPreviousSnapshot: true,
            status: "retained",
          }),
        }),
      }),
    ],
  });

  assert.ok(logs.includes("CEDIS: refresh completed successfully with zero alerts."));
  assert.ok(logs.includes("VIK: refresh retained the previous cache with 3 alert(s)."));
});

test("reports cache and refresh failures without replacing an existing snapshot", async () => {
  const logs: string[] = [];
  const result = await initializeCityAlertCaches({
    ensureDirectory: async () => undefined,
    log: (message) => logs.push(message),
    providers: [
      provider({
        readCache: async () => ({ error: { code: "cache-invalid-json" }, snapshot: null }),
        refresh: async () => ({
          summary: {
            ...collectorSummary({
              errorCode: "cedis-request-timeout",
              cacheStatus: "unavailable",
              status: "unavailable",
            }),
          },
        }),
      }),
    ],
  });

  assert.deepEqual(result.providers, [{ id: "CEDIS", state: "failed" }]);
  assert.ok(logs.includes("CEDIS: cache missing (cache-invalid-json); refresh started."));
  assert.ok(logs.includes("CEDIS: refresh failed (cedis-request-timeout)."));
});

test("bounds a stalled background initialization", async () => {
  const logs: string[] = [];
  const result = await initializeCityAlertCaches({
    ensureDirectory: async () => undefined,
    log: (message) => logs.push(message),
    providers: [provider({ refresh: async () => new Promise(() => undefined) })],
    refreshTimeoutMs: 1,
  });

  assert.deepEqual(result.providers, [{ id: "CEDIS", state: "failed" }]);
  assert.ok(logs.some((message) => message.includes("CEDIS refresh timed out.")));
});
