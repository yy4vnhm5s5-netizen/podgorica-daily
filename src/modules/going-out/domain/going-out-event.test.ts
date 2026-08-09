import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeGoingOutEvent,
  selectUpcomingGoingOutEvents,
  sortAndDeduplicateGoingOutEvents,
} from "./going-out-event.ts";

test("normalizes a Podgorica going-out event and preserves an unavailable time", () => {
  const event = normalizeGoingOutEvent({
    city: "podgorica",
    sourceUrl: "https://staging.montegigs.me/me/events/podgorica/5520-20260825-summer-jam",
    startDate: "2026-08-25",
    title: "  Summer Jam: Željko Samardžić  ",
    venue: " Elit Restoran Bar ",
  });

  assert.deepEqual(event, {
    city: "podgorica",
    id: "https://staging.montegigs.me/me/events/podgorica/5520-20260825-summer-jam|2026-08-25||summer jam: željko samardžić",
    sourceName: "MonteGigs",
    sourceEventId: "5520",
    sourceUrl: "https://staging.montegigs.me/me/events/podgorica/5520-20260825-summer-jam",
    startDate: "2026-08-25",
    title: "Summer Jam: Željko Samardžić",
    venue: "Elit Restoran Bar",
  });
});

test("keeps the composite ID independent from source identity and optional enrichment", () => {
  const baseline = normalizeGoingOutEvent({
    city: "podgorica",
    sourceUrl: "https://staging.montegigs.me/me/events/podgorica/5520-20260825-summer-jam",
    startDate: "2026-08-25",
    title: "Summer Jam",
  });
  const enriched = normalizeGoingOutEvent({
    city: "podgorica",
    eventType: "  Concert ",
    genre: " Pop ",
    isFree: true,
    performers: [" Željko Samardžić ", "željko samardžić", "", " Slađa Allegro "],
    priceLabel: "10",
    sourceEventId: "5520",
    sourceUrl: "https://staging.montegigs.me/me/events/podgorica/5520-20260825-summer-jam",
    startDate: "2026-08-25",
    title: "  Summer   Jam ",
  });

  assert.ok(baseline);
  assert.ok(enriched);
  assert.equal(baseline.id, enriched.id);
  assert.equal(enriched.sourceEventId, "5520");
  assert.equal(enriched.eventType, "Concert");
  assert.equal(enriched.genre, "Pop");
  assert.equal(enriched.isFree, true);
  assert.equal(enriched.priceLabel, undefined);
  assert.deepEqual(enriched.performers, ["Željko Samardžić", "Slađa Allegro"]);
  assert.equal(
    normalizeGoingOutEvent({
      city: "podgorica",
      sourceEventId: "5521",
      sourceUrl: "https://staging.montegigs.me/me/events/podgorica/5520-20260825-summer-jam",
      startDate: "2026-08-25",
      title: "Summer Jam",
    }),
    undefined,
  );
});

test("filters past days in Europe/Podgorica and keeps deterministic ordering", () => {
  const events = [
    normalizeGoingOutEvent({
      city: "podgorica",
      sourceUrl: "https://staging.montegigs.me/me/events/podgorica/1-20260721-past",
      startDate: "2026-07-21",
      title: "Past",
    }),
    normalizeGoingOutEvent({
      city: "podgorica",
      sourceUrl: "https://staging.montegigs.me/me/events/podgorica/2-20260722-today",
      startDate: "2026-07-22",
      title: "Today",
    }),
    normalizeGoingOutEvent({
      city: "podgorica",
      sourceUrl: "https://staging.montegigs.me/me/events/podgorica/3-20260723-next",
      startDate: "2026-07-23",
      title: "Next",
    }),
  ].filter((event) => event !== undefined);

  assert.deepEqual(
    selectUpcomingGoingOutEvents(events, new Date("2026-07-22T20:00:00.000Z")).map(
      (event) => event.title,
    ),
    ["Today", "Next"],
  );
  assert.equal(sortAndDeduplicateGoingOutEvents([...events, events[1]!]).length, 3);
});
