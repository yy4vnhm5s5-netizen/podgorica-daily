import assert from "node:assert/strict";
import test from "node:test";
import { getCityEvents } from "../application/get-city-events.ts";
import { getEnabledEventProviders, eventProviderRegistry } from "./event-provider-registry.ts";
import { refreshTourismEvents } from "./tourism-refresh.ts";
import { tourismEventProvider } from "./tourism-event-provider.ts";
const context = {
  city: {
    country: "Montenegro",
    id: "podgorica" as const,
    isActive: true,
    isMain: true,
    latitude: 42,
    longitude: 19,
    name: "Podgorica",
    slug: "podgorica",
    timezone: "Europe/Podgorica",
  },
  locale: "me" as const,
  timezone: "Europe/Podgorica",
};
test("registers Tourism only through the live registry and never fetches in application reads", async () => {
  assert.equal(tourismEventProvider.metadata.id, "tourism-podgorica");
  assert.equal(
    getEnabledEventProviders({ ENABLE_EVENTS: false, EVENT_PROVIDER_MODE: "live" }).length,
    0,
  );
  assert.equal(
    getEnabledEventProviders({ ENABLE_EVENTS: true, EVENT_PROVIDER_MODE: "mock" }).length,
    0,
  );
  assert.ok(
    getEnabledEventProviders({ ENABLE_EVENTS: true, EVENT_PROVIDER_MODE: "live" }).includes(
      tourismEventProvider,
    ),
  );
  assert.ok(
    [
      "kic-budo-tomovic",
      "cnp",
      "glavni-grad-podgorica",
      "tourism-podgorica",
      "cineplexx-podgorica",
    ].every((id) => eventProviderRegistry.some((provider) => provider.metadata.id === id)),
  );
  const result = await getCityEvents(context, [
    {
      ...tourismEventProvider,
      getCachedEvents: async () => ({
        events: [],
        parserWarnings: [],
        state: "unavailable" as const,
        venues: [],
      }),
    },
  ]);
  assert.deepEqual(result.events, []);
  assert.equal(result.providers[0]?.state, "unavailable");
});
test("retains a usable Tourism snapshot for zero-valid and complete failures", async () => {
  const previous = {
    events: [
      {
        category: "concert" as const,
        cityId: "podgorica" as const,
        cityIds: ["podgorica" as const],
        id: "old",
        language: "me" as const,
        sourceId: "tourism-podgorica",
        sourceName: "Tourism",
        sourceReferences: [],
        sourceUrl: "https://podgorica.travel/old",
        startsAt: "2026-07-20T19:00:00.000Z",
        status: "scheduled" as const,
        tags: [],
        timezone: "Europe/Podgorica",
        title: "Old",
      },
    ],
    fetchedAt: "2026-07-01T00:00:00.000Z",
    freshnessStatus: "fresh" as const,
    lastSuccessfulRefreshAt: "2026-07-01T00:00:00.000Z",
    parserWarnings: [],
    provider: {
      displayName: "Tourism",
      id: "tourism-podgorica",
      sourceUrl: "https://podgorica.travel/dogadjaji-kalendar/",
    },
    schemaVersion: 2 as const,
    venues: [],
  };
  const result = await refreshTourismEvents({
    cachePath: "/tmp/tourism.json",
    context,
    previousSnapshot: previous,
    httpClient: {
      get: async () => {
        throw new Error("offline");
      },
    },
  });
  assert.equal(result.retainedPreviousSnapshot, true);
  assert.equal(result.snapshot, previous);
  assert.equal(result.success, false);
});
