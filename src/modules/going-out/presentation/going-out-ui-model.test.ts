import assert from "node:assert/strict";
import test from "node:test";

import type { GoingOutEvent } from "../domain/going-out-event.ts";
import {
  formatGoingOutSchedule,
  getAvailableGoingOutEvents,
  getGoingOutDisplayState,
  getHomepageGoingOutEvents,
} from "./going-out-ui-model.ts";

const events: GoingOutEvent[] = Array.from({ length: 7 }, (_, index) => ({
  city: "podgorica",
  id: `event-${index}`,
  sourceName: "MonteGigs",
  sourceUrl: `https://staging.montegigs.me/me/events/podgorica/${index}-202607${String(22 + index).padStart(2, "0")}-event`,
  startDate: `2026-07-${String(22 + index).padStart(2, "0")}`,
  title: `Event ${index}`,
}));

test("limits homepage presentation to six cached upcoming events", () => {
  assert.equal(getHomepageGoingOutEvents(events, new Date("2026-07-22T10:00:00.000Z")).length, 6);
});

test("returns every available upcoming event for a dashboard count", () => {
  const now = new Date("2026-07-22T10:00:00.000Z");

  assert.equal(getAvailableGoingOutEvents(events, now).length, 7);
});

test("separates empty, unavailable and stale presentation states", () => {
  assert.equal(getGoingOutDisplayState({ eventCount: 0, state: "fresh" }), "empty");
  assert.equal(getGoingOutDisplayState({ eventCount: 0, state: "unavailable" }), "unavailable");
  assert.equal(getGoingOutDisplayState({ eventCount: 1, state: "stale" }), "stale");
});

test("renders only the date when MonteGigs omits an event time", () => {
  const schedule = formatGoingOutSchedule(events[0]!, "me");

  assert.doesNotMatch(schedule, /Vrijeme nije navedeno/u);
  assert.doesNotMatch(schedule, /·/u);
});

test("renders an explicit source time when MonteGigs provides one", () => {
  const schedule = formatGoingOutSchedule(
    { ...events[0]!, startsAt: "2026-07-22T18:30:00.000Z" },
    "me",
  );

  assert.match(schedule, /20:30/u);
});
