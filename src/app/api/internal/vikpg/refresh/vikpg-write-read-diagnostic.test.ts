import assert from "node:assert/strict";
import test from "node:test";

import { buildVikpgWriteReadBackDiagnostic } from "./vikpg-write-read-diagnostic.ts";

const resolvedCachePath = "/app/.runtime/cache/vikpg-water-alerts.json";
const summary = {
  cachePath: resolvedCachePath,
  lastSuccessfulRefreshAt: "2026-07-30T13:00:00.000Z",
};

test("reports matching timestamps and record count when the read-back succeeds", async () => {
  const result = await buildVikpgWriteReadBackDiagnostic({
    getProcessId: () => 4242,
    readCache: async () => ({
      alerts: [{ id: "a" }, { id: "b" }] as never[],
      fetchedAt: "2026-07-30T13:00:00.000Z",
      freshnessStatus: "fresh",
      lastSuccessfulRefreshAt: "2026-07-30T13:00:00.000Z",
      parserWarnings: [],
      schemaVersion: 1,
      source: "Vodovod i kanalizacija Podgorica",
      sourceUrl: "https://vikpg.me/mediji/servisne-informacije/obavjestenja.html",
    }),
    summary,
  });

  assert.deepEqual(result, {
    cacheReadBackAlertCount: 2,
    cacheReadBackFetchedAt: "2026-07-30T13:00:00.000Z",
    cacheReadBackLastSuccessfulRefreshAt: "2026-07-30T13:00:00.000Z",
    processId: 4242,
    resolvedCachePath,
    writtenLastSuccessfulRefreshAt: "2026-07-30T13:00:00.000Z",
  });
});

test("reports a safe error code, not a crash, when the read-back finds nothing", async () => {
  const result = await buildVikpgWriteReadBackDiagnostic({
    getProcessId: () => 1,
    readCache: async () => null,
    summary,
  });

  assert.equal(result.cacheReadBackError, "cache-read-back-empty");
  assert.equal(result.cacheReadBackAlertCount, undefined);
  assert.equal(result.resolvedCachePath, resolvedCachePath);
});

test("reports a safe, fixed error code without leaking the thrown error's message", async () => {
  const result = await buildVikpgWriteReadBackDiagnostic({
    getProcessId: () => 1,
    readCache: async () => {
      throw new Error("ENOENT: /app/.runtime/cache/vikpg-water-alerts.json?secretToken=abc123");
    },
    summary,
  });

  assert.equal(result.cacheReadBackError, "cache-read-back-failed");
  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes("secretToken"), false);
  assert.equal(serialized.includes("ENOENT"), false);
});

test("omits writtenLastSuccessfulRefreshAt when the summary has none", async () => {
  const result = await buildVikpgWriteReadBackDiagnostic({
    getProcessId: () => 1,
    readCache: async () => null,
    summary: { cachePath: resolvedCachePath },
  });

  assert.equal("writtenLastSuccessfulRefreshAt" in result, false);
});
