import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { podgoricaEvent } from "../__fixtures__/events.ts";
import { getCityEvents } from "../application/get-city-events.ts";
import type { EventProvider } from "../domain/event.ts";
import { createCnpEventProvider, cnpProviderMetadata } from "./cnp-event-provider.ts";
import { getEnabledEventProviders } from "./event-provider-registry.ts";
import { readEventCache, writeEventCache, type EventCacheSnapshot } from "./events-cache.ts";

const context = {
  city: {
    country: "Montenegro",
    id: "podgorica" as const,
    isActive: true,
    isMain: true,
    latitude: 42.441,
    longitude: 19.263,
    name: "Podgorica",
    slug: "podgorica",
    timezone: "Europe/Podgorica",
  },
  locale: "me" as const,
  timezone: "Europe/Podgorica",
};

const liveConfiguration = (cachePath: string) => ({
  CNP_EVENT_CACHE_PATH: cachePath,
  ENABLE_EVENTS: true,
  EVENT_CACHE_FRESHNESS_MINUTES: 120,
  EVENT_PROVIDER_MODE: "live" as const,
});

const snapshot = (
  events: EventCacheSnapshot["events"],
  overrides: Partial<EventCacheSnapshot> = {},
): EventCacheSnapshot => ({
  events,
  fetchedAt: new Date().toISOString(),
  freshnessStatus: "fresh",
  lastSuccessfulRefreshAt: new Date().toISOString(),
  parserWarnings: [],
  provider: {
    displayName: "Test provider",
    id: "test-provider",
    sourceUrl: "https://events.example.test",
  },
  schemaVersion: 2,
  venues: [],
  ...overrides,
});

async function withTemporaryCaches(run: (paths: { cnp: string; kic: string }) => Promise<void>) {
  const directory = await mkdtemp(join(tmpdir(), "podgorica-daily-events-"));
  try {
    await run({ cnp: join(directory, "cnp.json"), kic: join(directory, "kic.json") });
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
}

function cachedProvider({
  cachePath,
  id,
  name,
}: {
  cachePath: string;
  id: string;
  name: string;
}): EventProvider {
  return {
    getCachedEvents: async () => readEventCache(cachePath, 120),
    metadata: {
      cachePath,
      displayName: name,
      enabled: true,
      id,
      officialSource: "https://events.example.test",
      providerMode: "live",
      refreshIntervalMinutes: 60,
      sourceUrl: "https://events.example.test",
      supportedCityIds: ["podgorica"],
      supportsMultipleCities: false,
    },
  };
}

test("registers CNP only for enabled live events and preserves its official Podgorica metadata", () => {
  assert.deepEqual(
    getEnabledEventProviders({ ENABLE_EVENTS: false, EVENT_PROVIDER_MODE: "live" }),
    [],
  );
  assert.deepEqual(
    getEnabledEventProviders({ ENABLE_EVENTS: true, EVENT_PROVIDER_MODE: "disabled" }),
    [],
  );
  assert.deepEqual(
    getEnabledEventProviders({ ENABLE_EVENTS: true, EVENT_PROVIDER_MODE: "mock" }),
    [],
  );
  assert.ok(
    getEnabledEventProviders({ ENABLE_EVENTS: true, EVENT_PROVIDER_MODE: "live" }).some(
      (provider) => provider.metadata.id === "cnp",
    ),
  );
  assert.deepEqual(cnpProviderMetadata.supportedCityIds, ["podgorica"]);
  assert.equal(cnpProviderMetadata.officialSource, "https://cnp.me/repertoar/");
  assert.equal(cnpProviderMetadata.cachePath, ".runtime/cache/cnp-events.json");
  assert.equal(cnpProviderMetadata.refreshIntervalMinutes, 60);
});

test("reads the CNP cache without fetching and disables unsupported cities", async () => {
  let fetchCalls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    throw new Error("Application reads must not fetch.");
  }) as typeof fetch;
  try {
    const provider = createCnpEventProvider({
      configuration: liveConfiguration("/tmp/cnp-events.json"),
      readCache: async () => ({
        events: [podgoricaEvent({ sourceId: "cnp" })],
        parserWarnings: [],
        state: "fresh",
        venues: [],
      }),
    });
    assert.equal((await getCityEvents(context, [provider])).events.length, 1);
    assert.equal(fetchCalls, 0);
    const unsupported = await provider.getCachedEvents({
      ...context,
      city: { ...context.city, id: "bar" },
    });
    assert.equal(unsupported.state, "disabled");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("combines cached KIC and CNP events with deterministic sorting, shared deduplication, and provenance", async () => {
  await withTemporaryCaches(async ({ cnp, kic }) => {
    const kicEvent = podgoricaEvent({
      id: "kic-shared",
      sourceId: "kic-budo-tomovic",
      sourceName: "KIC Budo Tomović",
      sourceReferences: [
        {
          sourceId: "kic-budo-tomovic",
          sourceName: "KIC Budo Tomović",
          sourceUrl: "https://kic.podgorica.me/shared",
        },
      ],
      sourceUrl: "https://kic.podgorica.me/shared",
      startsAt: "2026-07-20T18:00:00.000Z",
      title: "Zajednički koncert",
      venueName: "KIC Budo Tomović",
    });
    const cnpEquivalent = {
      ...kicEvent,
      id: "cnp-shared",
      sourceId: "cnp",
      sourceName: "Crnogorsko narodno pozorište",
      sourceReferences: [
        {
          sourceId: "cnp",
          sourceName: "Crnogorsko narodno pozorište",
          sourceUrl: "https://cnp.me/shared",
        },
      ],
      sourceUrl: "https://cnp.me/shared",
      status: "cancelled" as const,
    };
    const cnpSeparatePerformance = {
      ...cnpEquivalent,
      id: "cnp-next-night",
      sourceUrl: "https://cnp.me/shared-next-night",
      sourceReferences: [
        { ...cnpEquivalent.sourceReferences[0], sourceUrl: "https://cnp.me/shared-next-night" },
      ],
      startsAt: "2026-07-21T18:00:00.000Z",
      status: "scheduled" as const,
    };
    const cnpSimilarTitleDifferentVenue = {
      ...cnpEquivalent,
      id: "cnp-other-venue",
      sourceUrl: "https://cnp.me/other-venue",
      sourceReferences: [
        { ...cnpEquivalent.sourceReferences[0], sourceUrl: "https://cnp.me/other-venue" },
      ],
      venueName: "Mala scena CNP",
      status: "scheduled" as const,
    };
    await writeEventCache(snapshot([kicEvent]), kic);
    await writeEventCache(
      snapshot([cnpEquivalent, cnpSeparatePerformance, cnpSimilarTitleDifferentVenue]),
      cnp,
    );

    const result = await getCityEvents(context, [
      cachedProvider({ cachePath: kic, id: "kic-budo-tomovic", name: "KIC" }),
      createCnpEventProvider({ configuration: liveConfiguration(cnp) }),
    ]);

    assert.equal(result.events.length, 2);
    assert.deepEqual(
      result.events.map((event) => event.startsAt),
      ["2026-07-20T18:00:00.000Z", "2026-07-21T18:00:00.000Z"],
    );
    const shared = result.events.find((event) => event.id === "kic-shared");
    assert.equal(shared?.status, "cancelled");
    assert.equal(shared?.sourceReferences.length, 3);
    assert.deepEqual(
      shared?.sourceReferences.map(({ sourceUrl }) => sourceUrl),
      ["https://kic.podgorica.me/shared", "https://cnp.me/shared", "https://cnp.me/other-venue"],
    );
    assert.equal(shared?.sourceId, "kic-budo-tomovic");
  });
});

test("isolates unavailable KIC and CNP caches and does not expose rejected cached events", async () => {
  await withTemporaryCaches(async ({ cnp, kic }) => {
    const accepted = podgoricaEvent({ id: "accepted", sourceId: "cnp" });
    const warning = podgoricaEvent({
      id: "warning",
      sourceId: "cnp",
      startsAt: "2026-07-18T18:00:00.000Z",
    });
    const rejected = podgoricaEvent({
      id: "rejected",
      sourceId: "cnp",
      startsAt: "2026-07-19T18:00:00.000Z",
    });
    await writeEventCache(
      snapshot([accepted, warning, rejected], {
        qualityDiagnostics: {
          acceptedCount: 1,
          acceptedWithWarningsCount: 1,
          candidatesDiscovered: 3,
          countDropWarning: false,
          deduplicatedCount: 0,
          finalEventCount: 2,
          normalizedCount: 3,
          qualityPolicyVersion: "1",
          qualityScoreDistribution: { "50to74": 1, "75to89": 0, "90to100": 2, below50: 0 },
          rejectedCount: 1,
          rejectionCounts: { "invalid-date": 1 },
          warningCounts: { "missing-venue": 1 },
        },
        rejectedEventIds: ["rejected"],
      }),
      cnp,
    );
    const cnpProvider = createCnpEventProvider({ configuration: liveConfiguration(cnp) });
    const unavailableKic = cachedProvider({ cachePath: kic, id: "kic-budo-tomovic", name: "KIC" });
    const cnpOnly = await getCityEvents(context, [cnpProvider, unavailableKic]);
    assert.deepEqual(
      cnpOnly.events.map((event) => event.id),
      ["accepted", "warning"],
    );
    assert.deepEqual(
      cnpOnly.providers.map(({ id, state }) => ({ id, state })),
      [
        { id: "cnp", state: "fresh" },
        { id: "kic-budo-tomovic", state: "unavailable" },
      ],
    );
    assert.equal(cnpOnly.providers[0]?.status.rejectedCount, 1);

    const kicOnly = await getCityEvents(context, [
      {
        ...unavailableKic,
        getCachedEvents: async () => ({
          events: [podgoricaEvent({ id: "kic-available", sourceId: "kic-budo-tomovic" })],
          parserWarnings: [],
          state: "fresh",
          venues: [],
        }),
      },
      createCnpEventProvider({ configuration: liveConfiguration(join(cnp, "missing")) }),
    ]);
    assert.deepEqual(
      kicOnly.events.map((event) => event.id),
      ["kic-available"],
    );
    assert.deepEqual(
      kicOnly.providers.map(({ id, state }) => ({ id, state })),
      [
        { id: "kic-budo-tomovic", state: "fresh" },
        { id: "cnp", state: "unavailable" },
      ],
    );

    const none = await getCityEvents(context, [
      unavailableKic,
      createCnpEventProvider({ configuration: liveConfiguration(join(cnp, "missing")) }),
    ]);
    assert.deepEqual(none.events, []);
    assert.ok(none.providers.every(({ state }) => state === "unavailable"));
  });
});

test("maps stale CNP cache diagnostics and retained-refresh errors through the existing provider health model", async () => {
  await withTemporaryCaches(async ({ cnp }) => {
    await writeEventCache(
      snapshot([podgoricaEvent({ id: "stale-cnp", sourceId: "cnp" })], {
        fetchedAt: "2020-01-01T00:00:00.000Z",
        lastRefreshError: "CNP request failed.",
        qualityDiagnostics: {
          acceptedCount: 1,
          acceptedWithWarningsCount: 0,
          candidatesDiscovered: 1,
          countDropWarning: true,
          deduplicatedCount: 0,
          finalEventCount: 1,
          normalizedCount: 1,
          previousSuccessfulEventCount: 3,
          qualityPolicyVersion: "1",
          qualityScoreDistribution: { "50to74": 0, "75to89": 0, "90to100": 1, below50: 0 },
          rejectedCount: 0,
          rejectionCounts: {},
          warningCounts: {},
        },
      }),
      cnp,
    );
    const result = await getCityEvents(context, [
      createCnpEventProvider({ configuration: liveConfiguration(cnp) }),
    ]);
    assert.equal(result.providers[0]?.state, "stale");
    assert.equal(result.providers[0]?.status.qualityHealthState, "failing");
    assert.equal(result.providers[0]?.status.countDropWarning, true);
    assert.equal(result.providers[0]?.status.lastError, "CNP request failed.");
  });
});
