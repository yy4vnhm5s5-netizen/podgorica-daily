import assert from "node:assert/strict";
import test from "node:test";

import type { GoingOutEvent } from "../domain/going-out-event.ts";
import {
  formatGoingOutSchedule,
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

test("separates empty, unavailable and stale presentation states", () => {
  assert.equal(getGoingOutDisplayState({ eventCount: 0, state: "fresh" }), "empty");
  assert.equal(getGoingOutDisplayState({ eventCount: 0, state: "unavailable" }), "unavailable");
  assert.equal(getGoingOutDisplayState({ eventCount: 1, state: "stale" }), "stale");
});

test("does not invent an event time when MonteGigs omits it", () => {
  assert.match(formatGoingOutSchedule(events[0]!, "me"), /Vrijeme nije navedeno$/);
});
