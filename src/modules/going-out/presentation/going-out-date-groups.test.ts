import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import type { GoingOutEvent } from "../domain/going-out-event.ts";
import {
  formatGoingOutDateHeading,
  groupGoingOutEventsByDate,
} from "./going-out-ui-model.ts";

const event = (startDate: string, title: string, venue?: string): GoingOutEvent => ({
  city: "budva",
  id: `https://staging.montegigs.me/me/events/budva/1-x-${title}|${startDate}||${title}`,
  sourceName: "MonteGigs",
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
  assert.equal(formatGoingOutDateHeading("2026-08-04", "me"), "Utorak, 4. avgust 2026.");
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

test("leaves the empty, stale, source-attribution and navigation behaviour untouched", async () => {
  const source = await readFile(new URL("./going-out-page.tsx", import.meta.url), "utf8");

  assert.match(source, /displayState === "events" \|\| displayState === "stale" \? \(/u);
  assert.match(source, /<EmptyState/u);
  assert.match(source, /\{copy\.stale\}/u);
  assert.match(source, /\{copy\.source\}/u);
  assert.match(source, /href=\{event\.sourceUrl\}/u);
  assert.match(source, /<ExploreCityLinks city=\{city\} exclude=\{\["goingOut"\]\} \/>/u);
  // No claim about counts, venues, nightlife or what is "on" in the city.
  assert.doesNotMatch(source, /najbolj|preporuč|klubov[ai]\b|nema izlazaka/iu);
});
