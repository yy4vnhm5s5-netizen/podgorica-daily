import assert from "node:assert/strict";
import test from "node:test";

import { podgoricaEvent } from "../__fixtures__/events.ts";
import { formatEventSchedule, getValidDate } from "./event-schedule.ts";

test("getValidDate returns undefined instead of an Invalid Date for a malformed value", () => {
  assert.equal(getValidDate("not-a-real-timestamp"), undefined);
  assert.equal(getValidDate(undefined), undefined);
  assert.ok(getValidDate("2026-07-28T18:00:00.000Z") instanceof Date);
});

test("formats a valid startsAt event exactly as before", () => {
  const label = formatEventSchedule(
    podgoricaEvent({ startsAt: "2026-07-17T18:00:00.000Z" }),
    "me",
  );

  assert.ok(label && label.length > 0);
});

test("falls back to startDate instead of throwing when startsAt does not parse as a valid date", () => {
  const event = podgoricaEvent({ startDate: "2026-07-28", startsAt: "not-a-real-timestamp" });

  assert.doesNotThrow(() => formatEventSchedule(event, "me"));
  const label = formatEventSchedule(event, "me");
  assert.ok(label && label.length > 0);
});

test("returns undefined instead of throwing when neither date field parses", () => {
  const event = podgoricaEvent({ startDate: undefined, startsAt: "not-a-real-timestamp" });

  assert.doesNotThrow(() => formatEventSchedule(event, "me"));
  assert.equal(formatEventSchedule(event, "me"), undefined);
});

test("formats a start–end time range without throwing when both startsAt and endsAt are valid", () => {
  // Regression test for the production incident on event_69551751721a37a8adb6: passing
  // dateStyle/timeStyle together with hour/minute component options to Intl.DateTimeFormat
  // throws a TypeError ("Invalid option : option") per the Internationalization API spec.
  // This only reproduced when an event had both a valid startsAt and a valid endsAt.
  const event = podgoricaEvent({
    endsAt: "2026-07-17T20:00:00.000Z",
    startsAt: "2026-07-17T18:00:00.000Z",
  });

  assert.doesNotThrow(() => formatEventSchedule(event, "me"));
  const label = formatEventSchedule(event, "me");
  assert.ok(label);
  assert.ok(label.includes("–"));
});

test("omits the end time instead of throwing when endsAt does not parse as a valid date", () => {
  const event = podgoricaEvent({
    endsAt: "not-a-real-timestamp",
    startsAt: "2026-07-17T18:00:00.000Z",
  });

  assert.doesNotThrow(() => formatEventSchedule(event, "me"));
  const label = formatEventSchedule(event, "me");
  assert.ok(label && !label.includes("–"));
});
