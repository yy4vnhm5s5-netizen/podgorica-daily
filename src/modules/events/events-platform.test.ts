import assert from "node:assert/strict";
import test from "node:test";

import { podgoricaEvent } from "./__fixtures__/events.ts";
import { getCityEvents } from "./application/get-city-events.ts";
import { queryEvents } from "./application/query-events.ts";
import {
  classifyEventMatch,
  deduplicateEvents,
  getEventSourcePriority,
} from "./domain/event-deduplication.ts";
import { createEventId, createEventSlug, normalizeEventCandidate } from "./domain/event-normalization.ts";
import { expandRecurrence, getEventStatus, toZonedIso } from "./domain/event-time.ts";
import { isValidCityEvent, normalizeEventCategory, type EventProvider } from "./domain/event.ts";

const city = {
  country: "Montenegro",
  displayName: "Podgorica",
  enabled: true,
  id: "podgorica" as const,
  latitude: 42.441,
  longitude: 19.263,
  slug: "podgorica",
  timezone: "Europe/Podgorica",
};
const context = { city, locale: "me" as const, timezone: city.timezone };

test("validates normalized events and maps unknown categories safely", () => {
  assert.equal(normalizeEventCategory("THEATRE"), "theatre");
  assert.equal(normalizeEventCategory("unclassified"), "other");
  assert.equal(isValidCityEvent(podgoricaEvent()), true);
  assert.equal(isValidCityEvent(podgoricaEvent({ startsAt: undefined })), false);
  assert.equal(isValidCityEvent(podgoricaEvent({ startsAt: "not-a-timestamp" })), false);
});

test("creates stable deterministic IDs and preserves incomplete candidate source text", () => {
  const identity = {
    cityId: "podgorica",
    sourceId: "kic",
    startsAt: "2026-07-17T20:00:00.000Z",
    title: "Koncert!",
    venue: "KIC",
  };
  assert.equal(createEventId(identity), createEventId({ ...identity, title: " koncert " }));
  assert.equal(createEventSlug("Koncert u KIC-u"), "koncert-u-kic-u");
  const normalized = normalizeEventCandidate(
    {
      parserWarnings: ["Time was unavailable."],
      rawDateText: "17. jul",
      rawTitle: "Program",
      source: { sourceId: "kic", sourceName: "KIC", sourceUrl: "https://kic.example.test/program" },
      timezone: "Europe/Podgorica",
    },
    context,
  );
  assert.equal(normalized.event, null);
  assert.ok(normalized.parserWarnings.includes("Time was unavailable."));
});

test("uses Europe/Podgorica offsets and preserves date-only events", () => {
  assert.equal(
    toZonedIso({ date: "2026-01-17", time: "20:00" }, city.timezone),
    "2026-01-17T19:00:00.000Z",
  );
  assert.equal(
    toZonedIso({ date: "2026-07-17", time: "20:00" }, city.timezone),
    "2026-07-17T18:00:00.000Z",
  );
  assert.equal(
    toZonedIso({ date: "2026-03-29", time: "04:00" }, city.timezone),
    "2026-03-29T02:00:00.000Z",
  );
  const normalized = normalizeEventCandidate(
    {
      parserWarnings: [],
      rawAddress: "Njegoševa 1",
      rawTitle: "Cjelodnevna izložba",
      source: {
        sourceId: "gallery",
        sourceName: "Galerija",
        sourceUrl: "https://gallery.example.test/event",
      },
      startDate: "2026-07-17",
      timezone: city.timezone,
    },
    context,
  );
  assert.equal(normalized.event?.startDate, "2026-07-17");
  assert.equal(normalized.event?.startsAt, undefined);
  assert.equal(normalized.event?.address, "Njegoševa 1");
});

test("calculates explicit and time-derived statuses including midnight events", () => {
  assert.equal(
    getEventStatus(
      { endsAt: "2026-07-18T00:30:00.000Z", startsAt: "2026-07-17T22:00:00.000Z" },
      new Date("2026-07-17T23:00:00.000Z"),
    ),
    "active",
  );
  assert.equal(
    getEventStatus(
      { explicitStatus: "cancelled", startsAt: "2026-07-20T10:00:00.000Z" },
      new Date("2026-07-21T10:00:00.000Z"),
    ),
    "cancelled",
  );
});

test("expands recurrence only inside the requested range and limit", () => {
  const occurrences = expandRecurrence(
    { frequency: "daily" },
    new Date("2026-07-01T10:00:00.000Z"),
    new Date("2026-07-02T00:00:00.000Z"),
    new Date("2026-07-10T00:00:00.000Z"),
    3,
  );
  assert.deepEqual(
    occurrences.map((date) => date.toISOString()),
    ["2026-07-02T10:00:00.000Z", "2026-07-03T10:00:00.000Z", "2026-07-04T10:00:00.000Z"],
  );
});

test("deduplicates exact and strong matches while retaining uncertain and separate dates", () => {
  const original = podgoricaEvent();
  const exact = podgoricaEvent({ description: "Richer description", id: "event_new" });
  const strong = podgoricaEvent({
    id: "event_other_source",
    sourceId: "official-venue",
    sourceName: "Official venue",
    sourceReferences: [
      {
        sourceId: "official-venue",
        sourceName: "Official venue",
        sourceUrl: "https://venue.example.test/show",
      },
    ],
    sourceUrl: "https://venue.example.test/show",
    title: "Ljetnji   koncert!",
  });
  const uncertain = podgoricaEvent({
    id: "event_uncertain",
    sourceId: "other-source",
    sourceReferences: [
      {
        sourceId: "other-source",
        sourceName: "Other source",
        sourceUrl: "https://other.example.test/event",
      },
    ],
    sourceUrl: "https://other.example.test/event",
    venueName: undefined,
  });
  const separateDate = podgoricaEvent({
    id: "event_second_night",
    startsAt: "2026-07-18T18:00:00.000Z",
  });
  assert.equal(classifyEventMatch(original, strong), "strong");
  assert.equal(classifyEventMatch(original, uncertain), "uncertain");
  const deduplicated = deduplicateEvents([original, exact, strong, uncertain, separateDate]);
  assert.equal(deduplicated.length, 3);
  assert.equal(deduplicated[0].sourceReferences.length, 2);
});

test("uses cancellation over scheduled copies and keeps provenance", () => {
  const scheduled = podgoricaEvent();
  const cancelled = podgoricaEvent({
    id: "event_cancelled",
    sourceId: "official",
    sourceName: "Official",
    sourceReferences: [
      {
        sourceId: "official",
        sourceName: "Official",
        sourceUrl: "https://official.example.test/event",
      },
    ],
    sourceUrl: "https://official.example.test/event",
    status: "cancelled",
  });
  const result = deduplicateEvents(
    [scheduled, cancelled],
    [
      { priority: 1, sourceId: "official" },
      { priority: 10, sourceId: "fixture-source" },
    ],
  );
  assert.equal(result[0].status, "cancelled");
  assert.equal(result[0].sourceReferences.length, 2);
});

test("prioritizes official sources over aggregators without naming a provider", () => {
  assert.ok(getEventSourcePriority("officialOrganizer") < getEventSourcePriority("aggregator"));
  assert.ok(getEventSourcePriority("officialVenue") < getEventSourcePriority("trustedPublisher"));
});

test("filters city-aware events across today, tomorrow, week, weekend, custom ranges and attributes", () => {
  const fridayEvening = podgoricaEvent({ isFree: true, startsAt: "2026-07-17T16:00:00.000Z" });
  const saturday = podgoricaEvent({
    category: "kids",
    id: "saturday",
    startsAt: "2026-07-18T10:00:00.000Z",
  });
  const fridayAllDay = podgoricaEvent({
    id: "all-day",
    startDate: "2026-07-17",
    startsAt: undefined,
  });
  const bar = podgoricaEvent({ cityIds: ["bar"], id: "bar-event" });
  const events = [fridayEvening, saturday, fridayAllDay, bar];
  const now = new Date("2026-07-17T08:00:00.000Z");
  assert.equal(queryEvents(events, context, { period: "today" }, now).length, 2);
  assert.equal(queryEvents(events, context, { period: "tomorrow" }, now).length, 1);
  assert.equal(queryEvents(events, context, { period: "currentWeek" }, now).length, 3);
  assert.equal(queryEvents(events, context, { period: "weekend" }, now).length, 2);
  assert.equal(
    queryEvents(events, context, { dateRange: { end: "2026-07-18", start: "2026-07-18" } }, now)
      .length,
    1,
  );
  assert.equal(queryEvents(events, context, { free: true }, now).length, 1);
  assert.equal(queryEvents(events, context, { categories: ["kids"] }, now).length, 1);
});

test("isolates unavailable event providers without inventing events", async () => {
  const availableProvider: EventProvider = {
    getCachedEvents: async () => ({
      events: [podgoricaEvent()],
      parserWarnings: [],
      state: "fresh",
      venues: [],
    }),
    metadata: {
      displayName: "Available",
      enabled: true,
      id: "available",
      officialSource: "test",
      refreshIntervalMinutes: 60,
      supportsMultipleCities: false,
    },
  };
  const failedProvider: EventProvider = {
    getCachedEvents: async () => Promise.reject(new Error("source unavailable")),
    metadata: { ...availableProvider.metadata, displayName: "Failed", id: "failed" },
  };
  const result = await getCityEvents(context, [availableProvider, failedProvider]);
  assert.equal(result.events.length, 1);
  assert.deepEqual(
    result.providers.map(({ id, state }) => ({ id, state })),
    [
      { id: "available", state: "fresh" },
      { id: "failed", state: "unavailable" },
    ],
  );
});
