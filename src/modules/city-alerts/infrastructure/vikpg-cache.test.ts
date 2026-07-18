import assert from "node:assert/strict";
import test from "node:test";

import {
  readVikpgCacheResult,
  writeVikpgCache,
  type CacheFileSystem,
  type VikpgCacheSnapshot,
} from "./vikpg-cache.ts";

const snapshot = (): VikpgCacheSnapshot => ({
  alerts: [],
  fetchedAt: "2026-07-20T10:00:00.000Z",
  freshnessStatus: "fresh",
  lastSuccessfulRefreshAt: "2026-07-20T10:00:00.000Z",
  parserWarnings: [],
  schemaVersion: 1,
  source: "Vodovod i kanalizacija Podgorica",
  sourceUrl: "https://vikpg.me/me/mediji/servisne-informacije/obavjestenja.html",
});

const memoryFileSystem = (overrides: Partial<CacheFileSystem> = {}): CacheFileSystem => ({
  mkdir: async () => undefined,
  readFile: async () => JSON.stringify(snapshot()),
  rename: async () => undefined,
  rm: async () => undefined,
  writeFile: async () => undefined,
  ...overrides,
});

test("writes VIK snapshots atomically through the shared cache filesystem", async () => {
  const calls: string[] = [];
  await writeVikpgCache(
    snapshot(),
    "runtime/vikpg.json",
    memoryFileSystem({
      rename: async (from, to) => {
        calls.push(`${from}->${to}`);
      },
      writeFile: async (path) => {
        calls.push(path);
      },
    }),
  );
  assert.deepEqual(calls, ["runtime/vikpg.json.tmp", "runtime/vikpg.json.tmp->runtime/vikpg.json"]);
});

test("reports invalid VIK cache JSON without throwing", async () => {
  const result = await readVikpgCacheResult(
    "runtime/vikpg.json",
    memoryFileSystem({ readFile: async () => "{" }),
  );
  assert.equal(result.snapshot, null);
  assert.equal(result.error?.code, "cache-invalid-json");
});
