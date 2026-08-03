import assert from "node:assert/strict";
import test from "node:test";

import {
  eventSitemapEndedWindowDays,
  getEventLifecycleState,
  hasEventEnded,
  isEventSitemapEligible,
} from "./event-lifecycle.ts";

// Fixed reference instant, never the real clock: 2026-08-03 14:00 in Europe/Podgorica (CEST,
// UTC+2), so the local date under test is 2026-08-03.
const now = new Date("2026-08-03T12:00:00.000Z");
const timezone = "Europe/Podgorica";
const options = { now, timezone };

test("a future event is upcoming", () => {
  assert.equal(
    getEventLifecycleState({ startsAt: "2026-08-10T18:00:00.000Z" }, options),
    "upcoming",
  );
  assert.equal(getEventLifecycleState({ startDate: "2026-08-05" }, options), "upcoming");
  // Later the same local day, before it starts.
  assert.equal(
    getEventLifecycleState({ startsAt: "2026-08-03T19:00:00.000Z" }, options),
    "upcoming",
  );
});

test("an event between its start and its declared end is ongoing", () => {
  assert.equal(
    getEventLifecycleState(
      { endsAt: "2026-08-03T20:00:00.000Z", startsAt: "2026-08-03T10:00:00.000Z" },
      options,
    ),
    "ongoing",
  );
});

test("an event that started today with no declared end stays ongoing for the rest of the day", () => {
  // The alternative would be inventing a duration and declaring a concert finished minutes after
  // the doors opened.
  assert.equal(
    getEventLifecycleState({ startsAt: "2026-08-03T09:00:00.000Z" }, options),
    "ongoing",
  );
  assert.equal(getEventLifecycleState({ startDate: "2026-08-03" }, options), "ongoing");
});

test("an event is ended once its declared end passes or its local day is over", () => {
  assert.equal(
    getEventLifecycleState(
      { endsAt: "2026-08-03T11:00:00.000Z", startsAt: "2026-08-03T09:00:00.000Z" },
      options,
    ),
    "ended",
  );
  assert.equal(getEventLifecycleState({ startsAt: "2026-08-02T19:00:00.000Z" }, options), "ended");
  assert.equal(getEventLifecycleState({ startDate: "2026-08-01" }, options), "ended");
  assert.equal(hasEventEnded({ startDate: "2026-08-01" }, options), true);
  assert.equal(hasEventEnded({ startDate: "2026-08-05" }, options), false);
});

test("an event whose dates do not parse is unknown, never silently ended", () => {
  assert.equal(getEventLifecycleState({}, options), "unknown");
  assert.equal(getEventLifecycleState({ startsAt: "not-a-date" }, options), "unknown");
  assert.equal(getEventLifecycleState({ startDate: "2026-02-30" }, options), "unknown");
  assert.equal(hasEventEnded({ startsAt: "not-a-date" }, options), false);
});

test("the local timezone decides the day boundary, not UTC", () => {
  // 2026-08-03T22:30Z is already 2026-08-04 in Podgorica (UTC+2), so an event dated 2026-08-04 has
  // not ended and is in fact under way.
  const lateEvening = { now: new Date("2026-08-03T22:30:00.000Z"), timezone };

  assert.equal(getEventLifecycleState({ startDate: "2026-08-04" }, lateEvening), "ongoing");
  assert.equal(getEventLifecycleState({ startDate: "2026-08-03" }, lateEvening), "ended");
});

test("the sitemap promotes upcoming and ongoing events", () => {
  assert.equal(isEventSitemapEligible({ startsAt: "2026-08-10T18:00:00.000Z" }, options), true);
  assert.equal(isEventSitemapEligible({ startDate: "2026-08-03" }, options), true);
});

test("the sitemap keeps a just-ended event only inside the bounded window", () => {
  assert.equal(eventSitemapEndedWindowDays, 2);

  // Ended 1 and 2 local days ago: still advertised, so crawlers re-read the page now that it says
  // the event is over.
  assert.equal(isEventSitemapEligible({ startDate: "2026-08-02" }, options), true);
  assert.equal(isEventSitemapEligible({ startDate: "2026-08-01" }, options), true);
  // Day 3 is past the boundary.
  assert.equal(isEventSitemapEligible({ startDate: "2026-07-31" }, options), false);
  assert.equal(isEventSitemapEligible({ startDate: "2026-07-05" }, options), false);
});

test("the window is measured from the declared end, not the start", () => {
  const multiDay = { endsAt: "2026-08-02T20:00:00.000Z", startsAt: "2026-07-20T18:00:00.000Z" };

  assert.equal(getEventLifecycleState(multiDay, options), "ended");
  assert.equal(isEventSitemapEligible(multiDay, options), true);
});

test("an undatable event is never promoted to the sitemap", () => {
  assert.equal(isEventSitemapEligible({}, options), false);
  assert.equal(isEventSitemapEligible({ startsAt: "not-a-date" }, options), false);
});

test("the window is a parameter, so the policy is explicit rather than hidden in the boundary", () => {
  assert.equal(
    isEventSitemapEligible({ startDate: "2026-07-31" }, { ...options, windowDays: 7 }),
    true,
  );
  assert.equal(
    isEventSitemapEligible({ startDate: "2026-08-02" }, { ...options, windowDays: 0 }),
    false,
  );
});
