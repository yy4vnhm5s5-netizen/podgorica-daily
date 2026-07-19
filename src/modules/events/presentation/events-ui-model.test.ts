import assert from "node:assert/strict";
import test from "node:test";

import { podgoricaEvent } from "../__fixtures__/events.ts";
import { getCityEvents } from "../application/get-city-events.ts";
import type { EventProvider } from "../domain/event.ts";
import {
  getEventCategoryLabel,
  getEventPresentationCategoryLabel,
  getEventsTranslations,
  getEventStatusLabel,
} from "./events-translations.ts";
import {
  filterEventsForUi,
  groupEventsByDay,
  parseEventsUiFilters,
  selectHomepageEvents,
} from "./events-ui-model.ts";
import { getEventPresentationCategory } from "./event-presentation-category.ts";

const context = {
  city: {
    country: "Montenegro",
    displayName: "Podgorica",
    enabled: true,
    id: "podgorica" as const,
    latitude: 42.441,
    longitude: 19.263,
    slug: "podgorica",
    timezone: "Europe/Podgorica",
  },
  locale: "me" as const,
  timezone: "Europe/Podgorica",
};

test("reads accepted cached events without invoking provider HTTP", async () => {
  let cachedReads = 0;
  const provider: EventProvider = {
    async getCachedEvents() {
      cachedReads += 1;
      return {
        events: [podgoricaEvent({ id: "accepted-event" })],
        parserWarnings: [],
        state: "fresh",
        venues: [],
      };
    },
    metadata: createProviderMetadata("kic", "KIC", "https://kic.podgorica.me"),
  };

  const readModel = await getCityEvents(context, [provider]);

  assert.equal(cachedReads, 1);
  assert.deepEqual(
    readModel.events.map((event) => event.id),
    ["accepted-event"],
  );
  assert.equal(readModel.events[0]?.slug, "ljetnji-koncert");
});

test("keeps rejected quality diagnostics out of public event results", async () => {
  const provider: EventProvider = {
    async getCachedEvents() {
      return {
        events: [podgoricaEvent({ id: "accepted-event" })],
        parserWarnings: [],
        qualityDiagnostics: { rejectedCount: 1 },
        state: "fresh",
        venues: [],
      };
    },
    metadata: createProviderMetadata("kic", "KIC", "https://kic.podgorica.me"),
  };

  const readModel = await getCityEvents(context, [provider]);

  assert.deepEqual(
    readModel.events.map((event) => event.id),
    ["accepted-event"],
  );
  assert.equal(readModel.events.length, 1);
});

test("filters cached events by search, source, user-facing category, and URL date preset", () => {
  const concert = podgoricaEvent({
    id: "concert",
    sourceId: "kic",
    sourceName: "KIC",
    title: "Ljetnji koncert",
  });
  const theatre = podgoricaEvent({
    category: "theatre",
    id: "theatre",
    sourceId: "cnp",
    sourceName: "CNP",
    startsAt: "2026-07-18T18:00:00.000Z",
    title: "Veče u pozorištu",
  });
  const filters = parseEventsUiFilters({
    category: "theatre",
    period: "upcoming",
    query: "pozorištu",
    source: "cnp",
  });

  const events = filterEventsForUi(
    [concert, theatre],
    context,
    filters,
    new Date("2026-07-17T10:00:00.000Z"),
  );

  assert.deepEqual(
    events.map((event) => event.id),
    ["theatre"],
  );
});

test("keeps all future events for the upcoming preset", () => {
  const seventhDay = podgoricaEvent({ id: "seventh-day", startsAt: "2026-07-23T18:00:00.000Z" });
  const eighthDay = podgoricaEvent({ id: "eighth-day", startsAt: "2026-07-24T18:00:00.000Z" });
  const filters = parseEventsUiFilters({ period: "upcoming" });

  const events = filterEventsForUi(
    [seventhDay, eighthDay],
    context,
    filters,
    new Date("2026-07-17T10:00:00.000Z"),
  );

  assert.deepEqual(
    events.map((event) => event.id),
    ["seventh-day", "eighth-day"],
  );
});

test("supports tomorrow and aggregates provider categories for the public UI", () => {
  const tomorrow = podgoricaEvent({ id: "tomorrow", startsAt: "2026-07-18T18:00:00.000Z" });
  const nextWeek = podgoricaEvent({ id: "next-week", startsAt: "2026-07-24T18:00:00.000Z" });
  const filters = parseEventsUiFilters({ period: "tomorrow" });

  assert.deepEqual(
    filterEventsForUi([tomorrow, nextWeek], context, filters, new Date("2026-07-17T10:00:00.000Z")).map(
      (event) => event.id,
    ),
    ["tomorrow"],
  );
  assert.equal(getEventPresentationCategory("concert"), "music");
  assert.equal(getEventPresentationCategory("workshop"), "education");
});

test("selects at most three upcoming events for the homepage cache read", () => {
  const events = [
    podgoricaEvent({ category: "movie", id: "movie", startsAt: "2026-07-17T12:00:00.000Z" }),
    podgoricaEvent({ id: "one", startsAt: "2026-07-17T13:00:00.000Z" }),
    podgoricaEvent({ id: "two", startsAt: "2026-07-18T13:00:00.000Z" }),
    podgoricaEvent({ id: "three", startsAt: "2026-07-19T13:00:00.000Z" }),
    podgoricaEvent({ id: "four", startsAt: "2026-07-20T13:00:00.000Z" }),
  ];

  assert.deepEqual(
    selectHomepageEvents(events, context, new Date("2026-07-17T10:00:00.000Z")).map(
      (event) => event.id,
    ),
    ["movie", "one", "two"],
  );
  assert.deepEqual(selectHomepageEvents([], context, new Date("2026-07-17T10:00:00.000Z")), []);
});

test("continues with tomorrow and later dates when no event remains today", () => {
  const events = [
    podgoricaEvent({ id: "earlier-today", startsAt: "2026-07-17T08:00:00.000Z" }),
    podgoricaEvent({ id: "tomorrow", startsAt: "2026-07-18T13:00:00.000Z" }),
    podgoricaEvent({ id: "next-date", startsAt: "2026-07-22T13:00:00.000Z" }),
  ];

  assert.deepEqual(
    selectHomepageEvents(events, context, new Date("2026-07-17T10:00:00.000Z")).map(
      (event) => event.id,
    ),
    ["tomorrow", "next-date"],
  );
});

test("groups separate event days and preserves missing optional data", () => {
  const first = podgoricaEvent({
    id: "first",
    imageUrl: undefined,
    organizer: undefined,
    startsAt: "2026-07-17T18:00:00.000Z",
    venueName: undefined,
  });
  const second = podgoricaEvent({ id: "second", startsAt: "2026-07-18T18:00:00.000Z" });

  const groups = groupEventsByDay([second, first], context.timezone);

  assert.equal(groups.length, 2);
  assert.deepEqual(
    groups.map((group) => group.events[0]?.id),
    ["first", "second"],
  );
  assert.equal(first.imageUrl, undefined);
  assert.equal(first.venueName, undefined);
});

test("supports all official provider names and communicates cancellation or postponement without colour alone", () => {
  const providerNames = [
    "KIC Budo Tomović",
    "Crnogorsko narodno pozorište",
    "Glavni Grad Podgorica",
    "Turistička organizacija Podgorice",
  ];

  assert.equal(new Set(providerNames).size, 4);
  assert.equal(getEventCategoryLabel("me", "concert"), "Koncert");
  assert.equal(getEventPresentationCategoryLabel("me", "music"), "Muzika");
  assert.equal(getEventsTranslations("me").quickFilters.tomorrow, "Sjutra");
  assert.equal(getEventsTranslations("me").officialSource, "Pogledajte originalnu objavu");
  assert.equal(getEventStatusLabel("me", "cancelled"), "Otkazano");
  assert.equal(getEventStatusLabel("en", "postponed"), "Postponed");
});

test("retains usable cached events when another provider is unavailable", async () => {
  const usableProvider: EventProvider = {
    async getCachedEvents() {
      return {
        events: [podgoricaEvent({ id: "usable" })],
        parserWarnings: [],
        state: "fresh",
        venues: [],
      };
    },
    metadata: createProviderMetadata("kic", "KIC", "https://kic.podgorica.me"),
  };
  const unavailableProvider: EventProvider = {
    async getCachedEvents() {
      return { events: [], parserWarnings: [], state: "unavailable", venues: [] };
    },
    metadata: createProviderMetadata("cnp", "CNP", "https://cnp.me"),
  };

  const readModel = await getCityEvents(context, [usableProvider, unavailableProvider]);

  assert.deepEqual(
    readModel.events.map((event) => event.id),
    ["usable"],
  );
  assert.equal(readModel.providers.find((provider) => provider.id === "cnp")?.state, "unavailable");
});

function createProviderMetadata(id: string, displayName: string, sourceUrl: string) {
  return {
    cachePath: `.runtime/cache/${id}-events.json`,
    displayName,
    enabled: true,
    id,
    officialSource: sourceUrl,
    refreshIntervalMinutes: 60,
    sourceUrl,
    supportedCityIds: ["podgorica"] as const,
    supportsMultipleCities: false,
  };
}
