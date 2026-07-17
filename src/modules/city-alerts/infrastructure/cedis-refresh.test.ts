import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import type { CedisCacheSnapshot } from "./cedis-cache.ts";
import {
  assertCedisUrl,
  createCedisHttpClient,
  CedisFetchError,
  type CedisHttpClient,
} from "./cedis-http-client.ts";
import { runCedisCollector } from "./collect-cedis.ts";
import { refreshCedis, type RefreshCache, type RefreshResult } from "./cedis-refresh.ts";

const fixture = (name: string) =>
  readFile(new URL(`./__fixtures__/${name}`, import.meta.url), "utf8");

const previousSnapshot = (): CedisCacheSnapshot => ({
  alerts: [{ id: "previous" }] as never[],
  fetchedAt: "2026-03-29T09:00:00.000Z",
  freshnessStatus: "fresh",
  lastSuccessfulRefreshAt: "2026-03-29T09:00:00.000Z",
  parserWarnings: [],
  schemaVersion: 1,
  source: "CEDIS",
  sourceUrl: "https://cedis.me/servisne-informacije/",
});

const createMemoryCache = (existing: CedisCacheSnapshot | null = null) => {
  let snapshot = existing;
  const cache: RefreshCache = {
    read: async () => snapshot,
    write: async (next) => {
      snapshot = next;
    },
  };
  return { cache, getSnapshot: () => snapshot };
};

const createFixtureClient = (pages: Record<string, string>): CedisHttpClient => ({
  get: async (url) => {
    const page = pages[url];
    if (!page) throw new CedisFetchError("cedis-request-failed", "Fixture request failed.");
    return page;
  },
});

const fixedNow = () => new Date("2026-03-29T12:00:00.000Z");
const listingUrl = "https://cedis.me/servisne-informacije/";
const articleUrl = "https://cedis.me/planirani-radovi-za-30-mart/";

test("refreshes listing, article, parser, and cache through injected HTTP", async () => {
  const memory = createMemoryCache();
  const result = await refreshCedis({
    cache: memory.cache,
    httpClient: createFixtureClient({
      [articleUrl]: await fixture("multi-municipality.html"),
      [listingUrl]: await fixture("listing.html"),
    }),
    now: fixedNow,
  });
  assert.equal(result.classification, "trustworthy-non-empty");
  assert.equal(result.success, true);
  assert.ok(result.snapshot?.alerts.length);
  assert.equal(memory.getSnapshot()?.alerts.length, result.snapshot?.alerts.length);
});

test("rejects external URLs before a fetch is attempted", () => {
  assert.throws(
    () => assertCedisUrl("https://example.com/outages"),
    (error: unknown) => error instanceof CedisFetchError && error.code === "cedis-host-rejected",
  );
  assert.doesNotThrow(() => assertCedisUrl(listingUrl));
});

test("classifies an injected listing timeout as a failed refresh", async () => {
  const client = createCedisHttpClient({
    fetchImplementation: async () => {
      const error = new Error("aborted");
      error.name = "AbortError";
      throw error;
    },
    retries: 0,
  });
  const result = await refreshCedis({
    cache: createMemoryCache().cache,
    httpClient: client,
    now: fixedNow,
  });
  assert.equal(result.classification, "failed");
  assert.equal(result.errorCode, "cedis-request-timeout");
});

test("returns a safe failure result when the cache cannot be read", async () => {
  const result = await refreshCedis({
    cache: {
      read: async () => {
        throw new Error("permission denied");
      },
      write: async () => undefined,
    },
    httpClient: createFixtureClient({}),
    now: fixedNow,
  });
  assert.equal(result.classification, "failed");
  assert.equal(result.errorCode, "cache-read-failed");
  assert.equal(result.retainedPreviousSnapshot, false);
});

test("retries a failed CEDIS request once by default", async () => {
  let attempts = 0;
  const client = createCedisHttpClient({
    fetchImplementation: async () => {
      attempts += 1;
      return { ok: false, status: 503, text: async () => "unavailable" };
    },
  });
  await assert.rejects(client.get(listingUrl), CedisFetchError);
  assert.equal(attempts, 2);
});

test("retains a previous cache when a required article fetch fails", async () => {
  const memory = createMemoryCache(previousSnapshot());
  const result = await refreshCedis({
    cache: memory.cache,
    httpClient: createFixtureClient({ [listingUrl]: await fixture("listing.html") }),
    now: fixedNow,
  });
  assert.equal(result.retainedPreviousSnapshot, true);
  assert.equal(result.snapshot?.alerts[0]?.id, "previous");
});

test("retains a previous cache when article markup is structurally suspicious", async () => {
  const memory = createMemoryCache(previousSnapshot());
  const result = await refreshCedis({
    cache: memory.cache,
    httpClient: createFixtureClient({
      [articleUrl]: "<html></html>",
      [listingUrl]: await fixture("listing.html"),
    }),
    now: fixedNow,
  });
  assert.equal(result.classification, "structurally-suspicious");
  assert.equal(result.retainedPreviousSnapshot, true);
});

test("replaces a previous cache with a confidently empty listing", async () => {
  const memory = createMemoryCache(previousSnapshot());
  const result = await refreshCedis({
    cache: memory.cache,
    httpClient: createFixtureClient({ [listingUrl]: "<a href='/vijest/'>Obavještenje</a>" }),
    now: fixedNow,
  });
  assert.equal(result.classification, "trustworthy-empty");
  assert.equal(result.retainedPreviousSnapshot, false);
  assert.equal(memory.getSnapshot()?.alerts.length, 0);
});

const refreshResult = (overrides: Partial<RefreshResult>): RefreshResult => ({
  classification: "trustworthy-non-empty",
  freshAlertCount: 1,
  retainedPreviousSnapshot: false,
  snapshot: previousSnapshot(),
  success: true,
  warnings: [],
  ...overrides,
});

test("collector exits zero after a successful refresh", async () => {
  const output: string[] = [];
  const result = await runCedisCollector({
    refresh: async () => refreshResult({}),
    writeOutput: (line) => output.push(line),
  });
  assert.equal(result.exitCode, 0);
  assert.equal(result.summary.status, "success");
  assert.deepEqual(Object.keys(JSON.parse(output[0])).sort(), [
    "alertCount",
    "cachePath",
    "cacheStatus",
    "completedAt",
    "retainedPreviousSnapshot",
    "status",
    "warnings",
  ]);
});

test("collector exits zero when it retains stale data", async () => {
  const result = await runCedisCollector({
    refresh: async () =>
      refreshResult({
        classification: "failed",
        retainedPreviousSnapshot: true,
        snapshot: { ...previousSnapshot(), freshnessStatus: "stale" },
        success: false,
      }),
    writeOutput: () => undefined,
  });
  assert.equal(result.exitCode, 0);
  assert.equal(result.summary.status, "retained");
});

test("collector exits non-zero when no cache is usable", async () => {
  const result = await runCedisCollector({
    refresh: async () =>
      refreshResult({
        classification: "failed",
        errorCode: "cedis-request-failed",
        snapshot: null,
        success: false,
      }),
    writeOutput: () => undefined,
  });
  assert.equal(result.exitCode, 1);
  assert.equal(result.summary.status, "unavailable");
});
