import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import type { VikpgCacheSnapshot } from "./vikpg-cache.ts";
import { createVikpgHttpClient, type VikpgHttpClient } from "./vikpg-http-client.ts";
import { refreshVikpg, type VikpgRefreshCache } from "./vikpg-refresh.ts";
import { vikpgWaterNoticesUrl } from "./vikpg-water-notices.ts";

const fixture = (name: string) =>
  readFile(new URL(`./__fixtures__/${name}`, import.meta.url), "utf8");
const fixedNow = () => new Date("2026-07-20T10:00:00.000Z");
const activeUrl = "https://vikpg.me/index.php?option=com_gridbox&view=page&id=2001&lang=me";
const plannedUrl = "https://vikpg.me/index.php?option=com_gridbox&view=page&id=2002&lang=me";
const secondaryActiveUrl =
  "https://vikpg.me/index.php?option=com_gridbox&view=page&id=2003&lang=me";

const previousSnapshot = (): VikpgCacheSnapshot => ({
  alerts: [{ id: "previous" }] as never[],
  fetchedAt: "2026-07-20T09:00:00.000Z",
  freshnessStatus: "fresh",
  lastSuccessfulRefreshAt: "2026-07-20T09:00:00.000Z",
  parserWarnings: [],
  schemaVersion: 1,
  source: "Vodovod i kanalizacija Podgorica",
  sourceUrl: vikpgWaterNoticesUrl,
});

function memoryCache(existing: VikpgCacheSnapshot | null = null) {
  let snapshot = existing;
  const cache: VikpgRefreshCache = {
    read: async () => snapshot,
    write: async (next) => {
      snapshot = next;
    },
  };
  return { cache, snapshot: () => snapshot };
}

function fixtureClient(pages: Record<string, string>): VikpgHttpClient {
  return { get: async (url) => pages[url] ?? Promise.reject(new Error("Missing fixture.")) };
}

test("writes active and planned water notices from a successful refresh", async () => {
  const memory = memoryCache();
  const result = await refreshVikpg({
    cache: memory.cache,
    httpClient: fixtureClient({
      [activeUrl]: await fixture("vikpg-active-outage.html"),
      [plannedUrl]: await fixture("vikpg-planned-interruption.html"),
      [secondaryActiveUrl]: await fixture("vikpg-active-secondary.html"),
      [vikpgWaterNoticesUrl]: await fixture("vikpg-listing.html"),
    }),
    now: fixedNow,
  });
  assert.equal(result.success, true);
  assert.equal(result.classification, "trustworthy-non-empty");
  assert.equal(memory.snapshot()?.alerts.length, 3);
  assert.deepEqual(
    memory
      .snapshot()
      ?.alerts.map(({ status }) => status)
      .sort(),
    ["active", "active", "scheduled"],
  );
});

test("retains a valid cache after a fetch failure", async () => {
  const memory = memoryCache(previousSnapshot());
  const result = await refreshVikpg({
    cache: memory.cache,
    httpClient: fixtureClient({}),
    now: fixedNow,
  });
  assert.equal(result.success, false);
  assert.equal(result.retainedPreviousSnapshot, true);
  assert.equal(result.snapshot?.alerts[0]?.id, "previous");
});

test("retains a valid cache for a suspicious empty parse", async () => {
  const memory = memoryCache(previousSnapshot());
  const result = await refreshVikpg({
    cache: memory.cache,
    httpClient: fixtureClient({
      [vikpgWaterNoticesUrl]:
        "<main><h2>Servisne informacije</h2><a href='/index.php?id=2001'>Informacija o kvaru</a></main>",
      "https://vikpg.me/index.php?id=2001": await fixture("vikpg-malformed.html"),
    }),
    now: fixedNow,
  });
  assert.equal(result.classification, "structurally-suspicious");
  assert.equal(result.retainedPreviousSnapshot, true);
});

test("replaces a cache with a genuinely empty successful listing", async () => {
  const memory = memoryCache(previousSnapshot());
  const result = await refreshVikpg({
    cache: memory.cache,
    httpClient: fixtureClient({
      [vikpgWaterNoticesUrl]:
        "<main><h2>Servisne informacije</h2><a href='/cjenovnik'>Novi cjenovnik</a></main>",
    }),
    now: fixedNow,
  });
  assert.equal(result.success, true);
  assert.equal(result.classification, "trustworthy-empty");
  assert.deepEqual(memory.snapshot()?.alerts, []);
});

test("retries transient VIK HTTP failures but not permanent failures", async () => {
  let attempts = 0;
  const transient = createVikpgHttpClient({
    fetchImplementation: async () => {
      attempts += 1;
      return attempts === 1
        ? { ok: false, status: 503, text: async () => "unavailable" }
        : { ok: true, status: 200, text: async () => "<main>ok</main>" };
    },
  });
  assert.equal(await transient.get(vikpgWaterNoticesUrl), "<main>ok</main>");
  assert.equal(attempts, 2);
  const permanent = createVikpgHttpClient({
    fetchImplementation: async () => {
      attempts += 1;
      return { ok: false, status: 404, text: async () => "missing" };
    },
  });
  await assert.rejects(permanent.get(vikpgWaterNoticesUrl));
  assert.equal(attempts, 3);
});
