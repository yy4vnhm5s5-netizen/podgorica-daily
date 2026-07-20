import assert from "node:assert/strict";
import test from "node:test";

import { initializeZpcgRailwayCache } from "./zpcg-railway-initialization.ts";

test("keeps a usable ŽPCG cache and does not refresh at startup", async () => {
  let refreshCalls = 0;
  const state = await initializeZpcgRailwayCache({
    cachePath: ".runtime/cache/zpcg-railway-departures.json",
    ensureDirectory: async () => undefined,
    log: () => undefined,
    readCache: async () => usableSnapshot(),
    refresh: async () => {
      refreshCalls += 1;
      return successfulCollection();
    },
  });

  assert.equal(state, "cache-found");
  assert.equal(refreshCalls, 0);
});

test("runs one collector refresh when the ŽPCG cache is unavailable", async () => {
  let refreshCalls = 0;
  const state = await initializeZpcgRailwayCache({
    cachePath: ".runtime/cache/zpcg-railway-departures.json",
    ensureDirectory: async () => undefined,
    log: () => undefined,
    readCache: async () => null,
    refresh: async () => {
      refreshCalls += 1;
      return successfulCollection();
    },
  });

  assert.equal(state, "refreshed");
  assert.equal(refreshCalls, 1);
});

function usableSnapshot() {
  return {
    departures: [],
    fetchedAt: "2026-07-20T08:00:00.000Z",
    freshnessStatus: "fresh" as const,
    lastSuccessfulRefreshAt: "2026-07-20T08:00:00.000Z",
    parserWarnings: [],
    schemaVersion: 1 as const,
    sourceUrl: "https://zpcg.me/red-voznje/ukupno",
    timetableDate: "2026-07-20",
  };
}

function successfulCollection() {
  const refresh = {
    acceptedDepartures: 2,
    phase: "cache" as const,
    retainedPreviousSnapshot: false,
    snapshot: usableSnapshot(),
    success: true,
    warnings: [],
  };
  return {
    exitCode: 0 as const,
    output: "provider=zpcg-railway state=success phase=cache accepted=2 cache=written",
    refresh,
    state: "success" as const,
  };
}
