import assert from "node:assert/strict";
import test from "node:test";

import {
  initializeCityAlertCaches,
  type CityAlertCacheProvider,
} from "./city-alerts-initialization.ts";

function provider(overrides: Partial<CityAlertCacheProvider> = {}): CityAlertCacheProvider {
  return {
    cachePath: "/runtime/cache/provider.json",
    enabled: true,
    id: "CEDIS",
    readCache: async () => ({ snapshot: null }),
    refresh: async () => ({
      summary: { alertCount: 0, retainedPreviousSnapshot: false, status: "success" },
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
        readCache: async () => ({ snapshot: { alerts: [] } }),
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

test("initializes a missing cache and logs the normalized result", async () => {
  const logs: string[] = [];
  const result = await initializeCityAlertCaches({
    ensureDirectory: async () => undefined,
    log: (message) => logs.push(message),
    providers: [
      provider({
        id: "VIK",
        refresh: async () => ({
          summary: { alertCount: 2, retainedPreviousSnapshot: false, status: "success" },
        }),
      }),
    ],
  });

  assert.deepEqual(result.providers, [{ alertCount: 2, id: "VIK", state: "refreshed" }]);
  assert.ok(logs.includes("VIK: cache missing; refresh started."));
  assert.ok(logs.includes("VIK: refresh completed with 2 alert(s)."));
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
            alertCount: 0,
            errorCode: "cedis-request-timeout",
            retainedPreviousSnapshot: false,
            status: "unavailable",
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
