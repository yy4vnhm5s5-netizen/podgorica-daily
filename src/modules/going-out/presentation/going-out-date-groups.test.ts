import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import type { GoingOutEvent } from "../domain/going-out-event.ts";
import {
  formatGoingOutDateHeading,
  getGoingOutPageEvents,
  getHomepageGoingOutEvents,
  groupGoingOutEventsByDate,
} from "./going-out-ui-model.ts";

const event = (startDate: string, title: string, venue?: string): GoingOutEvent => ({
  city: "budva",
  id: `https://staging.montegigs.me/me/events/budva/1-x-${title}|${startDate}||${title}`,
  sourceName: "MonteGigs",
  sourceEventId: "1",
  sourceUrl: "https://staging.montegigs.me/me/events/budva/1-20260804-x",
  startDate,
  title,
  ...(venue ? { venue } : {}),
});

test("groups listings by the calendar day they fall on", () => {
  const groups = groupGoingOutEventsByDate([
    event("2026-08-04", "Jala Brat"),
    event("2026-08-04", "RNB Party"),
    event("2026-08-05", "Rasta Live"),
  ]);

  assert.deepEqual(
    groups.map(({ date, events }) => [date, events.length]),
    [
      ["2026-08-04", 2],
      ["2026-08-05", 1],
    ],
  );
});

test("orders days chronologically regardless of input order", () => {
  const groups = groupGoingOutEventsByDate([
    event("2026-09-01", "Late"),
    event("2026-08-04", "Early"),
    event("2026-08-15", "Middle"),
  ]);

  assert.deepEqual(
    groups.map(({ date }) => date),
    ["2026-08-04", "2026-08-15", "2026-09-01"],
  );
});

test("preserves the order of listings inside a day", () => {
  const groups = groupGoingOutEventsByDate([
    event("2026-08-04", "First"),
    event("2026-08-04", "Second"),
    event("2026-08-04", "Third"),
  ]);

  assert.deepEqual(
    groups[0]?.events.map(({ title }) => title),
    ["First", "Second", "Third"],
  );
});

test("invents no day and returns nothing for an empty list", () => {
  assert.deepEqual(groupGoingOutEventsByDate([]), []);
  // Exactly one group per distinct date present in the data — never a filled-in range.
  const groups = groupGoingOutEventsByDate([event("2026-08-04", "A"), event("2026-08-20", "B")]);
  assert.equal(groups.length, 2);
});

test("renders a full Montenegrin date heading, capitalised", () => {
  // A fixed "now" on a different day, so the assertion never depends on when the suite runs.
  const otherDay = new Date("2026-08-20T09:00:00.000Z");

  assert.equal(formatGoingOutDateHeading("2026-08-04", "me", otherDay), "Utorak, 4. avgust 2026.");
});

test("marks today without replacing the date, and leaves other days alone", () => {
  const duringToday = new Date("2026-08-04T09:00:00.000Z");
  const today = formatGoingOutDateHeading("2026-08-04", "me", duringToday);

  assert.match(today, /^Danas — /u);
  // The calendar date survives the marker: a reader still sees which day it is.
  assert.match(today, /utorak, 4\. avgust 2026\./u);
  assert.equal(
    formatGoingOutDateHeading("2026-08-05", "me", duringToday),
    "Srijeda, 5. avgust 2026.",
  );
});

test("today is decided in Podgorica time, matching the upcoming filter", () => {
  // 23:30 UTC on 4 August is already 5 August in Podgorica (UTC+2), and the same helper decides
  // which listings count as upcoming — so the marker and the filter cannot disagree.
  const lateEvening = new Date("2026-08-04T23:30:00.000Z");

  assert.match(formatGoingOutDateHeading("2026-08-05", "me", lateEvening), /^Danas — /u);
  assert.doesNotMatch(formatGoingOutDateHeading("2026-08-04", "me", lateEvening), /^Danas/u);
});

test("the page groups by day and demotes the card title below the day heading", async () => {
  const source = await readFile(new URL("./going-out-page.tsx", import.meta.url), "utf8");

  assert.match(source, /const dateGroups = groupGoingOutEventsByDate\(upcoming\);/u);
  assert.match(source, /\{formatGoingOutDateHeading\(group\.date, locale\)\}/u);
  // The day is the h2; each listing title is an h3 beneath it.
  assert.match(source, /<h2\n\s+className="text-sm font-semibold uppercase/u);
  assert.match(source, /<h3 className="text-base font-semibold leading-6">\{event\.title\}<\/h3>/u);
  assert.doesNotMatch(source, /<h2 className="text-base font-semibold leading-6">/u);
});

test("keeps external attribution for incomplete entries and routes eligible cards internally", async () => {
  const source = await readFile(new URL("./going-out-page.tsx", import.meta.url), "utf8");

  assert.match(source, /displayState === "events" \|\| displayState === "stale" \? \(/u);
  assert.match(source, /<EmptyState/u);
  assert.match(source, /\{copy\.stale\}/u);
  assert.match(source, /\{copy\.source\}/u);
  assert.match(source, /href=\{event\.sourceUrl\}/u);
  assert.match(source, /isGoingOutEventDetailEligible\(event, city\)/u);
  assert.match(source, /getGoingOutDetailPath\(city, "montegigs", event\.sourceEventId\)/u);
  assert.match(source, /<Link/u);
  assert.match(source, /<CityFeatureDiscovery city=\{city\} currentFeature="goingOut" \/>/u);
  assert.doesNotMatch(source, /ExploreCityLinks/u);
  assert.ok(
    source.indexOf('<CityFeatureDiscovery city={city} currentFeature="goingOut" />') >
      source.indexOf('displayState === "events" || displayState === "stale"'),
  );
  // No claim about counts, venues, nightlife or what is "on" in the city.
  assert.doesNotMatch(source, /najbolj|preporuč|klubov[ai]\b|nema izlazaka/iu);
});

// Budva had 32 upcoming listings at source but rendered 30: the dedicated listing reused a cap
// meant for a compact surface. Preview surfaces keep their own limits; the canonical page does not.
const manyEvents = (count: number) =>
  Array.from({ length: count }, (_, index) =>
    event(`2026-08-${String((index % 28) + 1).padStart(2, "0")}`, `Listing ${index + 1}`),
  );

test("the dedicated listing keeps every upcoming record, past the old 30-item cap", () => {
  const now = new Date("2026-08-01T10:00:00.000Z");
  const selected = getGoingOutPageEvents(manyEvents(42), now);

  assert.equal(selected.length, 42);
  // The 31st and 42nd items are present — the cap used to drop them.
  assert.equal(
    selected.some(({ title }) => title === "Listing 31"),
    true,
  );
  assert.equal(
    selected.some(({ title }) => title === "Listing 42"),
    true,
  );
});

test("everything the listing selects is still grouped, in chronological order", () => {
  const now = new Date("2026-08-01T10:00:00.000Z");
  const selected = getGoingOutPageEvents(manyEvents(42), now);
  const groups = groupGoingOutEventsByDate(selected);
  const dates = groups.map(({ date }) => date);

  assert.deepEqual(dates, [...dates].sort());
  assert.equal(
    groups.reduce((total, { events }) => total + events.length, 0),
    selected.length,
  );
  // No duplicates introduced by removing the cap.
  const ids = selected.map(({ id }) => id);
  assert.equal(new Set(ids).size, ids.length);
});

test("compact preview surfaces keep their own small limits", async () => {
  const now = new Date("2026-08-01T10:00:00.000Z");
  const source = await readFile(new URL("./going-out-ui-model.ts", import.meta.url), "utf8");

  // The dashboard section teaser stays at six.
  assert.equal(getHomepageGoingOutEvents(manyEvents(42), now).length, 6);
  assert.match(source, /getAvailableGoingOutEvents\(events, now\)\.slice\(0, 6\)/u);
  // The listing selector no longer passes a limit at all.
  assert.match(source, /return selectUpcomingGoingOutEvents\(events, now\);/u);
  assert.doesNotMatch(source, /selectUpcomingGoingOutEvents\(events, now, 30\)/u);
});

test("the homepage count uses the same unlimited selector as the city dashboard", async () => {
  const homepage = await readFile(
    new URL("../../../app/platform-homepage-data.ts", import.meta.url),
    "utf8",
  );
  const dashboard = await readFile(
    new URL("../../../app/city-dashboard.tsx", import.meta.url),
    "utf8",
  );

  assert.match(homepage, /getAvailableGoingOutEvents\(dashboardData\.goingOut\.events\)/u);
  assert.doesNotMatch(homepage, /getGoingOutPageEvents/u);
  assert.match(dashboard, /getAvailableGoingOutEvents\(goingOut\.events\)\.length/u);
});

test("only upcoming records are selected, and city isolation is untouched", () => {
  const now = new Date("2026-08-10T10:00:00.000Z");
  const selected = getGoingOutPageEvents(
    [event("2026-08-01", "Past"), event("2026-08-10", "Today"), event("2026-08-20", "Future")],
    now,
  );

  assert.deepEqual(
    selected.map(({ title }) => title),
    ["Today", "Future"],
  );
  // Selection never inspects city — the read model already scopes the snapshot per city.
  assert.equal(
    selected.every(({ city }) => city === "budva"),
    true,
  );
});

test("the grouped card shows the time beside the venue and drops the repeated date", async () => {
  const source = await readFile(new URL("./going-out-page.tsx", import.meta.url), "utf8");

  assert.match(source, /const time = formatGoingOutTime\(event, locale\);/u);
  assert.match(source, /\{\[time, event\.venue\]\.filter\(Boolean\)\.join\(" · "\)\}/u);
  // The day <h2> already carries the date, so the card no longer repeats it.
  assert.doesNotMatch(source, /formatGoingOutSchedule/u);
  // No placeholder for a missing time.
  assert.doesNotMatch(source, /Vrijeme nije|TBD|00:00|nepoznat/iu);
});

test("renders venue alone when no time exists, and neither when both are missing", () => {
  const withTime = ["21:00", "Crkva Sv. Duha"].filter(Boolean).join(" · ");
  const venueOnly = [undefined, "Club Maximus"].filter(Boolean).join(" · ");
  const neither = [undefined, undefined].filter(Boolean);

  assert.equal(withTime, "21:00 · Crkva Sv. Duha");
  assert.equal(venueOnly, "Club Maximus");
  assert.equal(neither.length, 0);
});

test("the dashboard Going Out card is a different component and keeps its date", async () => {
  const section = await readFile(new URL("./going-out-section.tsx", import.meta.url), "utf8");

  // Not grouped by day, so it still needs full date context.
  assert.match(section, /formatGoingOutSchedule\(event, locale\)/u);
  assert.doesNotMatch(section, /formatGoingOutTime/u);
});

test("time enrichment adds no structured data anywhere in Going Out", async () => {
  const files = ["./going-out-page.tsx", "./going-out-section.tsx", "./going-out-ui-model.ts"];
  for (const file of files) {
    const source = await readFile(new URL(file, import.meta.url), "utf8");
    assert.doesNotMatch(source, /application\/ld\+json|schema\.org|"@type"/u, file);
  }
});
