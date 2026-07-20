import assert from "node:assert/strict";
import test from "node:test";

import { initializeEventCaches, type EventCacheProvider } from "./events-initialization.ts";
import type { EventRefreshSummary } from "./events-refresh-runner.ts";

const providerIds = [
  "cineplexx-podgorica",
  "kic",
  "cnp",
  "glavni-grad-podgorica",
  "tourism-podgorica",
] as const;

function provider(
  id: EventCacheProvider["id"],
  readCache: EventCacheProvider["readCache"],
): EventCacheProvider {
  return { cachePath: `/data/events/${id}.json`, enabled: true, id, readCache };
}

function refreshSummary(state: EventRefreshSummary["state"] = "success"): EventRefreshSummary {
  return {
    completedAt: "2026-07-19T08:01:00.000Z",
    providers: providerIds.map((id) => ({
      acceptedCount: id === "kic" ? 2 : 0,
      durationMs: 1,
      id,
      retainedPreviousSnapshot: id === "cnp",
      state: id === "cnp" ? "retained" : "success",
    })),
    startedAt: "2026-07-19T08:00:00.000Z",
    state,
  };
}

test("does not refresh when every enabled provider has a usable cache", async () => {
  let refreshCalls = 0;
  const messages: string[] = [];

  const summary = await initializeEventCaches({
    ensureDirectory: async () => undefined,
    log: (message) => messages.push(message),
    providers: providerIds.map((id) => provider(id, async () => ({ schemaVersion: 2 }))),
    refresh: async () => {
      refreshCalls += 1;
      return refreshSummary();
    },
  });

  assert.equal(refreshCalls, 0);
  assert.deepEqual(
    summary.providers.map(({ state }) => state),
    providerIds.map(() => "cache-found"),
  );
  assert.ok(messages.includes("Events: usable caches found; initialization refresh skipped."));
});

test("refreshes all providers once when an enabled cache is unavailable and logs cache outcomes", async () => {
  let refreshCalls = 0;
  const directories: string[] = [];
  const messages: string[] = [];

  const summary = await initializeEventCaches({
    ensureDirectory: async (path) => {
      directories.push(path);
    },
    log: (message) => messages.push(message),
    providers: providerIds.map((id) =>
      provider(id, async () => (id === "glavni-grad-podgorica" ? null : { schemaVersion: 2 })),
    ),
    refresh: async () => {
      refreshCalls += 1;
      return refreshSummary();
    },
  });

  assert.equal(refreshCalls, 1);
  assert.deepEqual(directories, providerIds.map((id) => `/data/events/${id}.json`));
  assert.equal(summary.refresh?.state, "success");
  assert.deepEqual(
    summary.providers.map(({ id, state }) => ({ id, state })),
    providerIds.map((id) => ({
      id,
      state: id === "glavni-grad-podgorica" ? "refreshed" : "cache-found",
    })),
  );
  assert.ok(messages.includes("Events: one or more caches are unavailable; refresh started."));
  assert.ok(messages.includes("Events: refresh completed with state success."));
});

test("keeps application startup safe when cache setup or refresh fails", async () => {
  const messages: string[] = [];

  const summary = await initializeEventCaches({
    ensureDirectory: async () => {
      throw new Error("permission denied");
    },
    log: (message) => messages.push(message),
    providers: [provider("kic", async () => null)],
    refresh: async () => {
      throw new Error("upstream unavailable");
    },
  });

  assert.deepEqual(summary.providers, [{ id: "kic", state: "failed" }]);
  assert.ok(messages.includes("Events/kic: cache initialization failed."));
  assert.ok(messages.includes("Events: initialization refresh failed."));
});
