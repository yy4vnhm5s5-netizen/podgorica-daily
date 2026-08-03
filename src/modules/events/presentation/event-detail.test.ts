import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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

test("shows the ended state from the injected reference time, not the frozen snapshot status", async () => {
  const source = await readFile(new URL("./event-detail.tsx", import.meta.url), "utf8");

  assert.match(
    source,
    /getEventDetailStatusNotice\(event, locale, \{ now, timezone: city\.timezone \}\)/u,
  );
  assert.match(source, /now = new Date\(\)/u);
  // The frozen snapshot status is no longer read directly for the visible notice.
  assert.doesNotMatch(source, /getEventStatusLabel\(locale, event\.status\)/u);
});

test("keeps the real date visible and adds no upcoming-flavoured call to action", async () => {
  const source = await readFile(new URL("./event-detail.tsx", import.meta.url), "utf8");

  // The schedule row is still rendered from the event's own dates, unconditionally.
  assert.match(source, /value=\{formatEventSchedule\(event, locale\)\}/u);
  assert.doesNotMatch(source, /Kupi|Rezerv|ulaznic|Ne propustite/iu);
});

test("a finished event is stated neutrally, unlike a cancelled or postponed one", async () => {
  const source = await readFile(new URL("./event-detail.tsx", import.meta.url), "utf8");

  assert.match(source, /ended: "text-muted-foreground"/u);
  assert.match(source, /cancelled:\n\s+"border-red-300/u);
});
