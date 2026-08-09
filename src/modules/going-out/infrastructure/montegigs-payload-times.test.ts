import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { parseMonteGigsEvents } from "./montegigs-going-out.ts";
import { createCityContext } from "@/shared/config/cities";

const fixtures = new URL("./__fixtures__/", import.meta.url);
const context = createCityContext("kotor");
const budva = createCityContext("budva");
const now = new Date("2026-08-01T10:00:00.000Z");

const parseFixture = async (name: string, city = context) =>
  parseMonteGigsEvents(await readFile(new URL(name, fixtures), "utf8"), city, now);

// MonteGigs renders "date • venue" and never prints a clock time; the same response embeds the
// React Query payload the page hydrated from, which carries the source's own `time`.
test("recovers a stated start time from the embedded payload", async () => {
  const parsed = await parseFixture("montegigs-kotor-payload-times.html");
  const event = parsed.events.find(({ title }) => title === "Vece klasike");

  assert.ok(event);
  assert.equal(event.startDate, "2026-08-04");
  // 21:00 in Europe/Podgorica on a summer date is 19:00Z — via the shared timezone utility.
  assert.equal(event.startsAt, "2026-08-04T19:00:00.000Z");
});

test("leaves a record without a stated time exactly as before", async () => {
  const parsed = await parseFixture("montegigs-kotor-payload-times.html");

  for (const title of ["Bez vremena", "Prazno vrijeme", "Neispravno vrijeme"]) {
    const event = parsed.events.find((candidate) => candidate.title === title);
    assert.ok(event, title);
    // null, "" and a malformed value all mean "no time" — never a substituted default.
    assert.equal(event.startsAt, undefined, title);
    assert.ok(event.startDate, title);
  }
});

// "00:00" appears on records that otherwise look time-less, so it is treated as MonteGigs' unset
// placeholder rather than an asserted midnight start we cannot verify.
test("treats 00:00 as unknown rather than a midnight start", async () => {
  const parsed = await parseFixture("montegigs-kotor-payload-times.html");
  const event = parsed.events.find(({ title }) => title === "Ponoc placeholder");

  assert.ok(event);
  assert.equal(event.startsAt, undefined);
});

test("joins payload to listing on the numeric MonteGigs id, never on title or date", async () => {
  const parsed = await parseFixture("montegigs-kotor-payload-times.html");

  // id 9999 exists only in the payload; it must not create an event or leak its 18:30 onto another.
  assert.equal(
    parsed.events.some(({ title }) => title === "Nije na listingu"),
    false,
  );
  assert.equal(
    parsed.events.some(({ startsAt }) => startsAt === "2026-08-09T16:30:00.000Z"),
    false,
  );
  // Exactly one event carries a time, and it is the one whose id matched.
  assert.equal(parsed.events.filter(({ startsAt }) => startsAt !== undefined).length, 1);
});

test("still parses the listing when the payload is absent or unparseable", async () => {
  const html = await readFile(new URL("montegigs-kotor-payload-times.html", fixtures), "utf8");
  const withoutPayload = html.replace(/<script[\s\S]*?<\/script>/gu, "");
  const corrupted = html.replace(/"events":\\"\[/gu, '"events":\\"[[[broken');

  for (const [label, source] of [
    ["no payload", withoutPayload],
    ["corrupted payload", corrupted],
  ] as const) {
    const parsed = parseMonteGigsEvents(source, context, now);

    // Time enrichment is best-effort: everything else is collected exactly as before.
    assert.equal(parsed.recognized, true, label);
    assert.equal(parsed.events.length, 5, label);
    assert.equal(parsed.events[0]?.venue, "Crkva Sv. Duha", label);
    assert.equal(parsed.events[0]?.startDate, "2026-08-04", label);
  }
  assert.equal(
    parseMonteGigsEvents(withoutPayload, context, now).events.every(
      ({ startsAt }) => startsAt === undefined,
    ),
    true,
  );
});

test("keeps venue, source URL and city untouched by the enrichment", async () => {
  const parsed = await parseFixture("montegigs-kotor-payload-times.html");
  const event = parsed.events.find(({ title }) => title === "Vece klasike");

  assert.ok(event);
  assert.equal(event.venue, "Crkva Sv. Duha");
  assert.equal(event.city, "kotor");
  assert.equal(event.sourceEventId, "3638");
  assert.match(event.sourceUrl, /^https:\/\/staging\.montegigs\.me\/me\/events\/kotor\/3638-/u);
});

test("preserves explicit performers, type, genre and source cost labels from the hydration payload", async () => {
  const parsed = await parseFixture("montegigs-budva-payload-enrichment.html", budva);
  const bySourceEventId = new Map(parsed.events.map((event) => [event.sourceEventId, event]));

  assert.deepEqual(bySourceEventId.get("7497"), {
    city: "budva",
    eventType: "Concert",
    genre: "Pop-folk",
    id: "https://staging.montegigs.me/me/events/budva/7497-20260809-jakov-jozinovic-live-in-budva|2026-08-09||jakov jozinović live in budva",
    imageUrl: "https://staging.montegigs.me/media/events/7925.jpg",
    performers: ["Jakov Jozinović"],
    priceLabel: "30-40",
    sourceEventId: "7497",
    sourceName: "MonteGigs",
    sourceUrl:
      "https://staging.montegigs.me/me/events/budva/7497-20260809-jakov-jozinovic-live-in-budva",
    startDate: "2026-08-09",
    title: "Jakov Jozinović Live in Budva",
    venue: "Top Hill",
  });
  assert.deepEqual(bySourceEventId.get("7906")?.performers, [
    "Danijel Đukić",
    "Tea Šufta",
    "Double D",
  ]);
  assert.equal(bySourceEventId.get("7906")?.isFree, true);
  assert.equal(bySourceEventId.get("7906")?.priceLabel, undefined);
  assert.equal(bySourceEventId.get("7024")?.priceLabel, "TBA");
});

test("omits optional enrichment fields when the hydration payload is unavailable", async () => {
  const html = await readFile(new URL("montegigs-kotor-payload-times.html", fixtures), "utf8");
  const withoutPayload = html.replace(/<script[\s\S]*?<\/script>/gu, "");
  const event = parseMonteGigsEvents(withoutPayload, context, now).events[0];

  assert.ok(event);
  assert.equal(event.sourceEventId, "3638");
  assert.equal(event.performers, undefined);
  assert.equal(event.eventType, undefined);
  assert.equal(event.genre, undefined);
  assert.equal(event.isFree, undefined);
  assert.equal(event.priceLabel, undefined);
});

test("reads only the approved enrichment fields from the hydration payload", async () => {
  const source = await readFile(new URL("./montegigs-going-out.ts", import.meta.url), "utf8");
  const extractor = /function extractMonteGigsEventPayloads[\s\S]*?\n\}/u.exec(source)?.[0];
  assert.ok(extractor);

  for (const field of ["address", "status", "venue_id", "organizer", "end_date", "end_time"]) {
    assert.doesNotMatch(extractor, new RegExp(field, "u"), field);
  }
});
