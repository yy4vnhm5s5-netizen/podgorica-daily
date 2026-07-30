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

const previousSnapshotWithMultipleAlerts = (): VikpgCacheSnapshot => ({
  alerts: [
    { id: "previous-active-stale", sourceUrl: activeUrl },
    { id: "previous-secondary", sourceUrl: secondaryActiveUrl },
  ] as never[],
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

// Regression coverage for the production bug: a discovery false-positive (or any single bad
// detail URL) used to make the whole Promise.all reject, discarding every other, perfectly valid
// notice in the same listing along with it.
test("succeeds when exactly one of two discovered notices fails to fetch", async () => {
  const memory = memoryCache();
  const failingUrl = "https://vikpg.me/index.php?option=com_gridbox&view=page&id=9001&lang=me";
  const result = await refreshVikpg({
    cache: memory.cache,
    httpClient: fixtureClient({
      [activeUrl]: await fixture("vikpg-active-outage.html"),
      // failingUrl intentionally has no fixture entry, so its detail fetch rejects, like a 404.
      [vikpgWaterNoticesUrl]: `<main><h2>Servisne informacije</h2>
        <a href="${activeUrl}">Informacija o kvaru, 20.07.2026.</a>
        <a href="${failingUrl}">Informacija o kvaru u Koniku, 20.07.2026.</a>
      </main>`,
    }),
    now: fixedNow,
  });

  assert.equal(result.success, true);
  assert.equal(result.classification, "trustworthy-non-empty");
  assert.equal(memory.snapshot()?.alerts.length, 1);
  assert.ok(result.warnings.includes("notice-fetch-failed:1"));
});

test("succeeds when multiple notices succeed and only one fails to fetch", async () => {
  const memory = memoryCache();
  const result = await refreshVikpg({
    cache: memory.cache,
    httpClient: fixtureClient({
      [activeUrl]: await fixture("vikpg-active-outage.html"),
      [plannedUrl]: await fixture("vikpg-planned-interruption.html"),
      // secondaryActiveUrl intentionally has no fixture entry here, so its detail fetch rejects —
      // the other two notices from the same listing must still be saved.
      [vikpgWaterNoticesUrl]: await fixture("vikpg-listing.html"),
    }),
    now: fixedNow,
  });

  assert.equal(result.success, true);
  assert.equal(result.classification, "trustworthy-non-empty");
  assert.deepEqual(
    memory
      .snapshot()
      ?.alerts.map(({ status }) => status)
      .sort(),
    ["active", "scheduled"],
  );
  assert.ok(result.warnings.includes("notice-fetch-failed:1"));
});

// Regression coverage for cache-replacement risk: refreshVikpg writes a full replacement snapshot
// with no merge in the ordinary success path, so a partial detail failure must not be treated the
// same as a clean success without protection — a notice we couldn't refetch is not evidence it
// expired.
test("carries forward the previous alert for a notice that fails to fetch, without duplicating one that succeeds", async () => {
  const memory = memoryCache(previousSnapshotWithMultipleAlerts());
  const result = await refreshVikpg({
    cache: memory.cache,
    httpClient: fixtureClient({
      [activeUrl]: await fixture("vikpg-active-outage.html"),
      // secondaryActiveUrl intentionally has no fixture entry, so its detail fetch rejects — the
      // previously cached alert for it must survive this refresh untouched.
      [vikpgWaterNoticesUrl]: `<main><h2>Servisne informacije</h2>
        <a href="${activeUrl}">Informacija o kvaru, 20.07.2026.</a>
        <a href="${secondaryActiveUrl}">Informacija o kvaru u Zabjelu, 20.07.2026.</a>
      </main>`,
    }),
    now: fixedNow,
  });

  assert.equal(result.success, true);
  const alertIds = memory
    .snapshot()
    ?.alerts.map(({ id }) => id)
    .sort();
  assert.equal(memory.snapshot()?.alerts.length, 2);
  // The stale entry for activeUrl is gone — its own fresh refetch this run replaces it, so the
  // two never coexist under different ids for the same notice.
  assert.equal(alertIds?.includes("previous-active-stale"), false);
  // The previously cached entry for secondaryActiveUrl survives: its fetch failed, so nothing
  // fresh could supersede it.
  assert.equal(alertIds?.includes("previous-secondary"), true);
});

// Regression coverage for strict string comparison being too narrow: the cache can end up storing
// a sourceUrl from an earlier VIK response that differs superficially from what this run's
// discovery produces (host prefix, query order, a tracking fragment) while pointing at the exact
// same notice. Carry-forward must still recognize it.
test("carries forward a previous alert whose sourceUrl differs only in host prefix, query order, and a fragment from the failed notice's URL", async () => {
  const wwwVariantUrl =
    "https://www.vikpg.me/index.php?lang=me&id=2001&view=page&option=com_gridbox#top";
  const memory = memoryCache({
    ...previousSnapshot(),
    alerts: [{ id: "previous-www-variant", sourceUrl: wwwVariantUrl }] as never[],
  });
  const result = await refreshVikpg({
    cache: memory.cache,
    httpClient: fixtureClient({
      [plannedUrl]: await fixture("vikpg-planned-interruption.html"),
      // activeUrl intentionally has no fixture entry, so its detail fetch rejects. Its canonical
      // form is exactly the "www." + reordered-query + fragment variant stored above.
      [vikpgWaterNoticesUrl]: `<main><h2>Servisne informacije</h2>
        <a href="${activeUrl}">Informacija o kvaru, 20.07.2026.</a>
        <a href="${plannedUrl}">Planirani radovi na vodovodnoj mreži, 21.07.2026.</a>
      </main>`,
    }),
    now: fixedNow,
  });

  assert.equal(result.success, true);
  const alertIds = memory.snapshot()?.alerts.map(({ id }) => id).sort();
  assert.equal(alertIds?.includes("previous-www-variant"), true);
  assert.equal(memory.snapshot()?.alerts.length, 2);
});

test("does not carry forward a previous alert whose sourceUrl cannot be canonicalized", async () => {
  const memory = memoryCache({
    ...previousSnapshot(),
    alerts: [
      { id: "previous-malformed", sourceUrl: "not a valid url" },
      { id: "previous-foreign-host", sourceUrl: "https://example.com/index.php?id=2001" },
    ] as never[],
  });
  const result = await refreshVikpg({
    cache: memory.cache,
    httpClient: fixtureClient({
      [plannedUrl]: await fixture("vikpg-planned-interruption.html"),
      // activeUrl intentionally has no fixture entry, so its detail fetch rejects — but neither
      // previous alert above can be canonicalized (one isn't a URL at all, the other is on a
      // different host), so neither is eligible for carry-forward regardless.
      [vikpgWaterNoticesUrl]: `<main><h2>Servisne informacije</h2>
        <a href="${activeUrl}">Informacija o kvaru, 20.07.2026.</a>
        <a href="${plannedUrl}">Planirani radovi na vodovodnoj mreži, 21.07.2026.</a>
      </main>`,
    }),
    now: fixedNow,
  });

  assert.equal(result.success, true);
  const alertIds = memory.snapshot()?.alerts.map(({ id }) => id);
  assert.equal(alertIds?.includes("previous-malformed"), false);
  assert.equal(alertIds?.includes("previous-foreign-host"), false);
  assert.equal(memory.snapshot()?.alerts.length, 1);
});

test("keeps today's retained/failure behavior, errorCode, and diagnostics when every notice detail fetch fails", async () => {
  const memory = memoryCache(previousSnapshot());
  const listingHtml = await fixture("vikpg-listing.html");
  const httpClient = createVikpgHttpClient({
    fetchImplementation: async (url) =>
      url === vikpgWaterNoticesUrl
        ? { ok: true, status: 200, text: async () => listingHtml, url }
        : {
            ok: false,
            status: 404,
            text: async () => "<html><body>Not Found</body></html>",
            url,
          },
    retries: 0,
  });

  const result = await refreshVikpg({ cache: memory.cache, httpClient, now: fixedNow });

  assert.equal(result.success, false);
  assert.equal(result.classification, "failed");
  assert.equal(result.errorCode, "vikpg-http-error");
  assert.equal(result.retainedPreviousSnapshot, true);
  assert.equal(result.snapshot?.alerts[0]?.id, "previous");
  assert.equal(result.diagnostics?.httpStatus, 404);
});

// The listing fetch itself is unchanged by notice-level fetch isolation: it still fails fast, and
// this pre-existing test's continued behavior is the regression proof for that.
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
        "<main><h2>Servisne informacije</h2><a href='/index.php?option=com_gridbox&amp;view=page&amp;id=2001&amp;lang=me'>Informacija o kvaru</a></main>",
      [activeUrl]: await fixture("vikpg-malformed.html"),
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

test("propagates a granular HTTP errorCode and sanitized diagnostics through a failed refresh", async () => {
  const memory = memoryCache(previousSnapshot());
  const httpClient = createVikpgHttpClient({
    fetchImplementation: async () => ({
      ok: false,
      status: 403,
      text: async () => "<html><body>Forbidden</body></html>",
      url: vikpgWaterNoticesUrl,
    }),
    retries: 0,
  });

  const result = await refreshVikpg({ cache: memory.cache, httpClient, now: fixedNow });

  assert.equal(result.success, false);
  assert.equal(result.errorCode, "vikpg-http-error");
  assert.equal(result.retainedPreviousSnapshot, true);
  assert.deepEqual(result.diagnostics, {
    finalUrl: vikpgWaterNoticesUrl,
    httpStatus: 403,
    responseBodyPreview: "Forbidden",
  });
  // The retained snapshot itself must stay exactly what it was — diagnostics live only on the
  // in-memory result, never written into the cache schema.
  assert.equal(memory.snapshot()?.alerts[0]?.id, "previous");
  assert.equal("diagnostics" in (memory.snapshot() ?? {}), false);
});

test("propagates vikpg-network-error and vikpg-empty-response distinctly (not the old generic vikpg-request-failed)", async () => {
  const networkResult = await refreshVikpg({
    cache: memoryCache(previousSnapshot()).cache,
    httpClient: createVikpgHttpClient({
      fetchImplementation: async () => {
        throw new Error("connection reset");
      },
      retries: 0,
    }),
    now: fixedNow,
  });
  assert.equal(networkResult.errorCode, "vikpg-network-error");

  const emptyResult = await refreshVikpg({
    cache: memoryCache(previousSnapshot()).cache,
    httpClient: createVikpgHttpClient({
      fetchImplementation: async () => ({ ok: true, status: 200, text: async () => "", url: "" }),
      retries: 0,
    }),
    now: fixedNow,
  });
  assert.equal(emptyResult.errorCode, "vikpg-empty-response");
});

test("leaves diagnostics entirely undefined for a timeout, instead of an empty object", async () => {
  const result = await refreshVikpg({
    cache: memoryCache(previousSnapshot()).cache,
    httpClient: createVikpgHttpClient({
      fetchImplementation: async () => {
        const error = new Error("aborted");
        error.name = "AbortError";
        throw error;
      },
      retries: 0,
    }),
    now: fixedNow,
  });

  assert.equal(result.errorCode, "vikpg-request-timeout");
  assert.equal(result.diagnostics, undefined);
});

test("does not attach diagnostics for a cache-read failure or a suspicious-empty classification", async () => {
  const readFailure = await refreshVikpg({
    cache: {
      read: () => Promise.reject(new Error("disk error")),
      write: async () => {},
    },
    // Never reached: cache.read() fails before any HTTP call would happen.
    httpClient: fixtureClient({}),
    now: fixedNow,
  });
  assert.equal(readFailure.errorCode, "cache-read-failed");
  assert.equal(readFailure.diagnostics, undefined);

  const memory = memoryCache(previousSnapshot());
  const suspiciousResult = await refreshVikpg({
    cache: memory.cache,
    httpClient: fixtureClient({
      [vikpgWaterNoticesUrl]:
        "<main><h2>Servisne informacije</h2><a href='/index.php?option=com_gridbox&amp;view=page&amp;id=2001&amp;lang=me'>Informacija o kvaru</a></main>",
      [activeUrl]: await fixture("vikpg-malformed.html"),
    }),
    now: fixedNow,
  });
  assert.equal(suspiciousResult.errorCode, "suspicious-empty-result");
  assert.equal(suspiciousResult.diagnostics, undefined);
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
