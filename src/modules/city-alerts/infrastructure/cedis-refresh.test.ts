import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  readCedisCacheResult,
  type CacheFileSystem,
  type CedisCacheSnapshot,
} from "./cedis-cache.ts";
import {
  assertCedisUrl,
  createCedisHttpClient,
  CedisFetchError,
  type CedisHttpClient,
} from "./cedis-http-client.ts";
import { runCedisCollector } from "./collect-cedis.ts";
import {
  createMemoizedCedisHttpClient,
  getActiveCedisContexts,
  runActiveCedisCollectors,
} from "./collect-cedis.ts";
import { refreshCedis, type RefreshCache, type RefreshResult } from "./cedis-refresh.ts";

const fixture = (name: string) =>
  readFile(new URL(`./__fixtures__/${name}`, import.meta.url), "utf8");

const previousSnapshot = (): CedisCacheSnapshot => ({
  alerts: [{ id: "previous" }] as never[],
  cityId: "podgorica",
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
const currentArticleUrl =
  "https://cedis.me/servisne-informacije/planirani-radovi-na-mrezi-za-22-jul/";
const collectorCachePath = join(tmpdir(), "podgorica-daily-cedis-collector-test.json");

const pollutedLegacySnapshot = () => ({
  alerts: [
    {
      affectedArea: {
        kind: "source",
        value:
          "none;} window.lazySizesConfig=window.lazySizesConfig||{};window.lazySizesConfig.loadMode=1;",
      },
      cityIds: ["podgorica"],
      dataMode: "live",
      description: { kind: "source", value: "Planirano isključenje." },
      id: "polluted-legacy-alert",
      publishedAt: "2026-07-04T12:00:00.000Z",
      severity: "information",
      source: { kind: "source", value: "CEDIS" },
      startsAt: "2026-07-04T12:00:00.000Z",
      status: "active",
      title: { kind: "source", value: "Planirano isključenje struje" },
      type: "powerOutage",
    },
  ],
  fetchedAt: "2026-07-04T12:00:00.000Z",
  freshnessStatus: "fresh",
  lastSuccessfulRefreshAt: "2026-07-04T12:00:00.000Z",
  parserWarnings: [],
  schemaVersion: 1,
  source: "CEDIS",
  sourceUrl: listingUrl,
});

const cacheFileSystem = (contents: string): CacheFileSystem => ({
  mkdir: async () => undefined,
  readFile: async () => contents,
  rename: async () => undefined,
  rm: async () => undefined,
  writeFile: async () => undefined,
});

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

test("emits CEDIS-only diagnostics for the real Elementor article-content shape", async () => {
  const diagnostics: Record<string, unknown>[] = [];
  const elementorArticleUrl =
    "https://cedis.me/servisne-informacije/planirani-radovi-na-mrezi-za-23-jul/";
  const pages = {
    [elementorArticleUrl]: await fixture("cedis-elementor-theme-post-content.html"),
    [listingUrl]: `<a href="${elementorArticleUrl}">Planirani radovi na mreži za 23. jul</a>`,
  };
  const result = await refreshCedis({
    cache: createMemoryCache().cache,
    diagnostic: (payload) => diagnostics.push(payload),
    httpClient: {
      get: async (url) => {
        const html = pages[url as keyof typeof pages];
        if (html) return html;
        throw new CedisFetchError("cedis-request-failed", "Fixture request failed.");
      },
      getDocument: async (url) => {
        const html = pages[url as keyof typeof pages];
        if (!html) throw new CedisFetchError("cedis-request-failed", "Fixture request failed.");
        return {
          contentType: "text/html; charset=UTF-8",
          finalUrl: url,
          html,
          status: 200,
        };
      },
    },
    now: () => new Date("2026-07-22T12:00:00.000Z"),
  });

  assert.equal(result.classification, "trustworthy-non-empty");
  assert.equal(result.freshAlertCount, 4);
  const listingDiagnostic = diagnostics[0];
  assert.equal(listingDiagnostic.event, "cedis-refresh-listing-fetched");
  assert.equal(listingDiagnostic.finalUrl, listingUrl);
  assert.equal(listingDiagnostic.httpStatus, 200);
  assert.equal(listingDiagnostic.contentType, "text/html; charset=UTF-8");
  assert.equal(listingDiagnostic.htmlLength, pages[listingUrl].length);
  assert.deepEqual(
    diagnostics.find((payload) => payload.event === "cedis-refresh-article-discovery"),
    { cityId: "podgorica", event: "cedis-refresh-article-discovery", plannedWorkArticleCount: 1 },
  );
  assert.deepEqual(
    diagnostics.find((payload) => payload.event === "cedis-refresh-article-parsed"),
    {
      articleUrl: elementorArticleUrl,
      cityId: "podgorica",
      contentSelector: ".elementor-widget-theme-post-content",
      event: "cedis-refresh-article-parsed",
      extractionState: "municipality-section-found",
      municipalitySectionFound: true,
      parsedRecordCount: 4,
    },
  );
  assert.deepEqual(diagnostics.at(-1), {
    cacheWriteResult: "written",
    cityId: "podgorica",
    event: "cedis-refresh-cache-write",
    freshAlertCount: 4,
    retainedPreviousSnapshot: false,
  });
});

test("reuses one fetched source document set for every active CEDIS city", async () => {
  const requests: string[] = [];
  const client = createMemoizedCedisHttpClient({
    get: async (url) => `<article>${url}</article>`,
    getDocument: async (url) => {
      requests.push(url);
      return { finalUrl: url, html: `<article>${url}</article>`, status: 200 };
    },
  });
  const cities = [
    {
      capabilities: ["electricity"] as const,
      country: "Montenegro",
      id: "podgorica",
      isActive: true,
      isMain: true,
      latitude: 42.441,
      longitude: 19.263,
      name: "Podgorica",
      slug: "podgorica",
      timezone: "Europe/Podgorica",
    },
    {
      capabilities: ["electricity"] as const,
      country: "Montenegro",
      id: "budva",
      isActive: true,
      isMain: false,
      latitude: 42.2864,
      longitude: 18.8401,
      name: "Budva",
      slug: "budva",
      timezone: "Europe/Podgorica",
    },
  ];

  const results = await runActiveCedisCollectors({
    cities,
    createContext: (cityId) => ({
      city: cities.find((city) => city.id === cityId)!,
      locale: "me",
      timezone: "Europe/Podgorica",
    }),
    httpClient: client,
    runCollector: async (context, sharedClient) => {
      await sharedClient.getDocument?.("https://cedis.me/servisne-informacije/");
      await sharedClient.getDocument?.("https://cedis.me/article/");
      return {
        exitCode: 0,
        summary: {
          alertCount: 0,
          cachePath: `${context.city.id}.json`,
          cacheStatus: "fresh",
          completedAt: "2026-03-29T12:00:00.000Z",
          retainedPreviousSnapshot: false,
          status: "success",
          warnings: [],
        },
      };
    },
  });

  assert.equal(results.length, 2);
  assert.deepEqual(requests, [
    "https://cedis.me/servisne-informacije/",
    "https://cedis.me/article/",
  ]);
});

test("selects only active CEDIS-supported electricity cities for scheduled collection", () => {
  const contexts = getActiveCedisContexts(
    [
      {
        capabilities: ["electricity"] as const,
        country: "Montenegro",
        id: "podgorica",
        isActive: true,
        isMain: true,
        latitude: 0,
        longitude: 0,
        name: "Podgorica",
        slug: "podgorica",
        timezone: "Europe/Podgorica",
      },
      {
        capabilities: ["electricity"] as const,
        country: "Montenegro",
        id: "budva",
        isActive: false,
        isMain: false,
        latitude: 0,
        longitude: 0,
        name: "Budva",
        slug: "budva",
        timezone: "Europe/Podgorica",
      },
    ],
    (cityId) => ({
      city: {
        capabilities: ["electricity"],
        country: "Montenegro",
        id: cityId,
        isActive: true,
        isMain: cityId === "podgorica",
        latitude: 0,
        longitude: 0,
        name: cityId,
        slug: cityId,
        timezone: "Europe/Podgorica",
      },
      locale: "me",
      timezone: "Europe/Podgorica",
    }),
  );

  assert.deepEqual(
    contexts.map((context) => context.city.id),
    ["podgorica"],
  );
});

test("continues with another city snapshot when one city refresh is unavailable", async () => {
  const cities = [
    {
      capabilities: ["electricity"] as const,
      country: "Montenegro",
      id: "podgorica",
      isActive: true,
      isMain: true,
      latitude: 0,
      longitude: 0,
      name: "Podgorica",
      slug: "podgorica",
      timezone: "Europe/Podgorica",
    },
    {
      capabilities: ["electricity"] as const,
      country: "Montenegro",
      id: "budva",
      isActive: true,
      isMain: false,
      latitude: 0,
      longitude: 0,
      name: "Budva",
      slug: "budva",
      timezone: "Europe/Podgorica",
    },
  ];
  const calls: string[] = [];
  const results = await runActiveCedisCollectors({
    cities,
    createContext: (cityId) => ({
      city: cities.find((city) => city.id === cityId)!,
      locale: "me",
      timezone: "Europe/Podgorica",
    }),
    runCollector: async (context) => {
      calls.push(context.city.id);
      const unavailable = context.city.id === "podgorica";
      return {
        exitCode: unavailable ? 1 : 0,
        summary: {
          alertCount: unavailable ? 0 : 1,
          cachePath: `${context.city.id}.json`,
          cacheStatus: unavailable ? "unavailable" : "fresh",
          completedAt: "2026-03-29T12:00:00.000Z",
          ...(unavailable ? { errorCode: "cedis-request-failed" } : {}),
          retainedPreviousSnapshot: false,
          status: unavailable ? "unavailable" : "success",
          warnings: [],
        },
      };
    },
  });

  assert.deepEqual(calls, ["podgorica", "budva"]);
  assert.deepEqual(
    results.map(({ exitCode }) => exitCode),
    [1, 0],
  );
});

test("replaces, rather than merges, a prior cache with clean current CEDIS notices", async () => {
  const memory = createMemoryCache(previousSnapshot());
  const result = await refreshCedis({
    cache: memory.cache,
    httpClient: createFixtureClient({
      [currentArticleUrl]: await fixture("cedis-bare-municipality-heading.html"),
      [listingUrl]: `<a href="${currentArticleUrl}">Planirani radovi na mreži za 22. jul</a>`,
    }),
    now: () => new Date("2026-07-21T12:00:00.000Z"),
  });

  assert.equal(result.classification, "trustworthy-non-empty");
  assert.equal(result.freshAlertCount, 4);
  assert.equal(result.snapshot?.alerts.length, 4);
  assert.equal(memory.getSnapshot()?.alerts.length, 4);
  assert.ok(!memory.getSnapshot()?.alerts.some((alert) => alert.id === "previous"));
  assert.ok(
    result.snapshot?.alerts.every(
      (alert) => alert.status === "scheduled" && alert.type === "powerOutage",
    ),
  );
});

test("replaces a rejected polluted legacy cache with clean fresh CEDIS notices", async () => {
  const legacyCache = await readCedisCacheResult(
    "cache.json",
    cacheFileSystem(JSON.stringify(pollutedLegacySnapshot())),
  );
  assert.equal(legacyCache.snapshot, null);

  const memory = createMemoryCache(legacyCache.snapshot);
  const result = await refreshCedis({
    cache: memory.cache,
    httpClient: createFixtureClient({
      [currentArticleUrl]: await fixture("cedis-bare-municipality-heading.html"),
      [listingUrl]: `<a href="${currentArticleUrl}">Planirani radovi na mreži za 22. jul</a>`,
    }),
    now: () => new Date("2026-07-21T12:00:00.000Z"),
  });

  assert.equal(result.success, true);
  assert.equal(memory.getSnapshot()?.alerts.length, 4);
  assert.ok(
    memory
      .getSnapshot()
      ?.alerts.every(
        (alert) =>
          alert.affectedArea.kind !== "source" ||
          !alert.affectedArea.value.includes("lazySizesConfig"),
      ),
  );
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

test("writes a trustworthy empty result for a city when only its municipality section is missing from otherwise-parseable articles", async () => {
  // multi-municipality.html only contains Podgorica and Nikšić sections. For Budva, that
  // article's only warning is the benign "municipality-section-not-found" — this must not be
  // treated as structurally suspicious, since the article was fetched and parsed successfully;
  // it simply isn't about Budva. Previously this incorrectly retained stale/no data forever.
  const previousBudva = {
    ...previousSnapshot(),
    alerts: [{ id: "budva-previous", cityIds: ["budva"] }] as never[],
    cityId: "budva" as const,
  };
  const memory = createMemoryCache(previousBudva);
  const result = await refreshCedis({
    cache: memory.cache,
    context: {
      city: {
        capabilities: ["electricity"],
        country: "Montenegro",
        id: "budva",
        isActive: false,
        isMain: false,
        latitude: 42.2864,
        longitude: 18.8401,
        name: "Budva",
        slug: "budva",
        timezone: "Europe/Podgorica",
      },
      locale: "me",
      timezone: "Europe/Podgorica",
    },
    httpClient: createFixtureClient({
      [articleUrl]: await fixture("multi-municipality.html"),
      [listingUrl]: await fixture("listing.html"),
    }),
    now: fixedNow,
  });

  assert.equal(result.classification, "trustworthy-empty");
  assert.equal(result.success, true);
  assert.equal(result.retainedPreviousSnapshot, false);
  assert.equal(result.snapshot?.cityId, "budva");
  assert.deepEqual(result.snapshot?.alerts, []);
});

test("retains a previous snapshot when no article has any recognizable municipality heading", async () => {
  const memory = createMemoryCache(previousSnapshot());
  const result = await refreshCedis({
    cache: memory.cache,
    httpClient: createFixtureClient({
      [articleUrl]: "<article><p>Obavještenje bez navedenih opština.</p></article>",
      [listingUrl]: await fixture("listing.html"),
    }),
    now: fixedNow,
  });

  assert.equal(result.classification, "structurally-suspicious");
  assert.equal(result.errorCode, "suspicious-empty-result");
  assert.equal(result.retainedPreviousSnapshot, true);
  assert.equal(result.snapshot?.alerts[0]?.id, "previous");
});

test("combines a Podgorica-present article with a benign Podgorica-absent article into one trustworthy non-empty result", async () => {
  const secondArticleUrl = "https://cedis.me/planirani-radovi-za-31-mart/";
  const result = await refreshCedis({
    cache: createMemoryCache().cache,
    httpClient: createFixtureClient({
      [articleUrl]: await fixture("multi-municipality.html"),
      [secondArticleUrl]: "<article><p>Budva – od 08 do 15 sati: Centar.</p></article>",
      [listingUrl]:
        '<a href="/planirani-radovi-za-30-mart/">Planirani radovi na mreži za 30. mart</a>' +
        '<a href="/planirani-radovi-za-31-mart/">Planirani radovi na mreži za 31. mart</a>',
    }),
    now: fixedNow,
  });

  assert.equal(result.classification, "trustworthy-non-empty");
  assert.equal(result.success, true);
  assert.ok(result.snapshot && result.snapshot.alerts.length > 0);
  assert.ok(result.warnings.includes("municipality-section-not-found"));
  assert.ok(!result.warnings.includes("no-municipality-headings-recognized"));
});

test("writes a valid explicitly empty municipality section", async () => {
  const emptyArticleUrl = "https://cedis.me/planirani-radovi-za-31-mart/";
  const result = await refreshCedis({
    cache: createMemoryCache().cache,
    context: {
      city: {
        capabilities: ["electricity"],
        country: "Montenegro",
        id: "budva",
        isActive: false,
        isMain: false,
        latitude: 42.2864,
        longitude: 18.8401,
        name: "Budva",
        slug: "budva",
        timezone: "Europe/Podgorica",
      },
      locale: "me",
      timezone: "Europe/Podgorica",
    },
    httpClient: createFixtureClient({
      [emptyArticleUrl]: "<article><p>Budva</p><p>Nema planiranih radova.</p></article>",
      [listingUrl]: `<a href="${emptyArticleUrl}">Planirani radovi za 31. mart</a>`,
    }),
    now: fixedNow,
  });

  assert.equal(result.success, true);
  assert.equal(result.classification, "trustworthy-empty");
  assert.equal(result.snapshot?.cityId, "budva");
  assert.deepEqual(result.snapshot?.alerts, []);
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

test("writes a confirmed empty snapshot after a polluted legacy cache was rejected", async () => {
  const legacyCache = await readCedisCacheResult(
    "cache.json",
    cacheFileSystem(JSON.stringify(pollutedLegacySnapshot())),
  );
  assert.equal(legacyCache.snapshot, null);

  const memory = createMemoryCache(legacyCache.snapshot);
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
    cachePath: collectorCachePath,
    refresh: async () => refreshResult({}),
    writeOutput: (line) => output.push(line),
  });
  assert.equal(result.exitCode, 0);
  assert.equal(result.summary.status, "success");
  assert.deepEqual(Object.keys(JSON.parse(output[0])).sort(), [
    "alertCount",
    "cachePath",
    "cacheStatus",
    "cityId",
    "completedAt",
    "retainedPreviousSnapshot",
    "status",
    "warnings",
  ]);
});

test("collector exits zero when it retains stale data", async () => {
  const result = await runCedisCollector({
    cachePath: collectorCachePath,
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
    cachePath: collectorCachePath,
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

test("collector prevents overlapping refreshes for one cache path", async () => {
  let releaseRefresh: (() => void) | undefined;
  let refreshStarted: (() => void) | undefined;
  const started = new Promise<void>((resolve) => {
    refreshStarted = resolve;
  });
  const first = runCedisCollector({
    cachePath: collectorCachePath,
    refresh: async () => {
      refreshStarted?.();
      await new Promise<void>((resolve) => {
        releaseRefresh = resolve;
      });
      return refreshResult({});
    },
    writeOutput: () => undefined,
  });
  await started;

  const overlapping = await runCedisCollector({
    cachePath: collectorCachePath,
    refresh: async () => refreshResult({}),
    writeOutput: () => undefined,
  });
  releaseRefresh?.();
  await first;

  assert.equal(overlapping.exitCode, 0);
  assert.equal(overlapping.summary.status, "already-running");
});

test("collector locks are isolated by CEDIS city snapshot", async () => {
  const calls: string[] = [];
  const contextFor = (cityId: "budva" | "podgorica") => ({
    city: {
      capabilities: ["electricity"] as const,
      country: "Montenegro",
      id: cityId,
      isActive: cityId === "podgorica",
      isMain: cityId === "podgorica",
      latitude: 0,
      longitude: 0,
      name: cityId,
      slug: cityId,
      timezone: "Europe/Podgorica",
    },
    locale: "me" as const,
    timezone: "Europe/Podgorica",
  });
  const result = await Promise.all([
    runCedisCollector({
      cachePath: join(tmpdir(), "cedis-podgorica-lock-test.json"),
      context: contextFor("podgorica"),
      refresh: async () => {
        calls.push("podgorica");
        return refreshResult({});
      },
      writeOutput: () => undefined,
    }),
    runCedisCollector({
      cachePath: join(tmpdir(), "cedis-budva-lock-test.json"),
      context: contextFor("budva"),
      refresh: async () => {
        calls.push("budva");
        return refreshResult({ snapshot: { ...previousSnapshot(), cityId: "budva" } });
      },
      writeOutput: () => undefined,
    }),
  ]);

  assert.deepEqual(calls.sort(), ["budva", "podgorica"]);
  assert.deepEqual(
    result.map(({ summary }) => summary.status),
    ["success", "success"],
  );
});
