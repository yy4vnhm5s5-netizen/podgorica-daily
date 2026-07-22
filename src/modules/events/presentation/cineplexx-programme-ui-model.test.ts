import assert from "node:assert/strict";
import test from "node:test";

import {
  getDistinctCineplexxMovieCount,
  getCineplexxProgrammeDisplayState,
  groupCineplexxProgramme,
  selectHomepageCinemaProgramme,
} from "./cineplexx-programme-ui-model.ts";

test("distinguishes Cineplexx empty, unavailable, fresh, and stale programme states", () => {
  assert.equal(
    getCineplexxProgrammeDisplayState({ eventCount: 0, providerState: "fresh" }),
    "empty",
  );
  assert.equal(
    getCineplexxProgrammeDisplayState({ eventCount: 0, providerState: "unavailable" }),
    "unavailable",
  );
  assert.equal(
    getCineplexxProgrammeDisplayState({ eventCount: 2, providerState: "fresh" }),
    "programme",
  );
  assert.equal(
    getCineplexxProgrammeDisplayState({ eventCount: 2, providerState: "stale" }),
    "stale",
  );
});

test("groups same-day screenings of one Cineplexx movie without merging another movie", () => {
  const grouped = groupCineplexxProgramme([
    cinemaEvent({ id: "one", startsAt: "2026-07-20T14:20:00.000Z", title: "Film" }),
    cinemaEvent({ id: "two", startsAt: "2026-07-20T16:30:00.000Z", title: "Film" }),
    cinemaEvent({ id: "three", startsAt: "2026-07-20T16:30:00.000Z", title: "Drugi film" }),
  ]);

  assert.deepEqual(
    grouped.map(({ screenings, title }) => ({ count: screenings.length, title })),
    [
      { count: 2, title: "Film" },
      { count: 1, title: "Drugi film" },
    ],
  );
});

test("counts distinct Cineplexx movies instead of individual screenings", () => {
  const firstScreening = cinemaEvent({
    id: "one",
    startsAt: "2026-07-20T14:20:00.000Z",
    title: "Film",
  });
  const secondScreening = {
    ...cinemaEvent({ id: "two", startsAt: "2026-07-20T16:30:00.000Z", title: "Film" }),
    tags: firstScreening.tags,
  };
  const otherMovie = cinemaEvent({
    id: "three",
    startsAt: "2026-07-20T16:30:00.000Z",
    title: "Drugi film",
  });

  assert.equal(getDistinctCineplexxMovieCount([firstScreening, secondScreening, otherMovie]), 2);
});

test("keeps remaining screenings today ahead of tomorrow's programme", () => {
  const programme = selectHomepageCinemaProgramme(
    [
      cinemaEvent({ id: "today", startsAt: "2026-07-21T18:30:00.000Z", title: "Film danas" }),
      cinemaEvent({ id: "tomorrow", startsAt: "2026-07-22T12:00:00.000Z", title: "Film sjutra" }),
    ],
    { now: new Date("2026-07-21T17:00:00.000Z"), timeZone: "Europe/Podgorica" },
  );

  assert.equal(programme.day, "today");
  assert.deepEqual(
    programme.events.map(({ id }) => id),
    ["today"],
  );
});

test("falls forward to tomorrow once today's final screening has ended", () => {
  const programme = selectHomepageCinemaProgramme(
    [
      cinemaEvent({ id: "past", startsAt: "2026-07-21T15:00:00.000Z", title: "Raniji film" }),
      cinemaEvent({ id: "tomorrow", startsAt: "2026-07-22T12:00:00.000Z", title: "Film sjutra" }),
      cinemaEvent({ id: "later", startsAt: "2026-07-23T12:00:00.000Z", title: "Film kasnije" }),
    ],
    { now: new Date("2026-07-21T17:00:00.000Z"), timeZone: "Europe/Podgorica" },
  );

  assert.equal(programme.day, "tomorrow");
  assert.deepEqual(
    programme.events.map(({ id }) => id),
    ["tomorrow"],
  );
});

test("uses the empty state only when neither today nor tomorrow has a remaining screening", () => {
  const programme = selectHomepageCinemaProgramme(
    [cinemaEvent({ id: "later", startsAt: "2026-07-23T12:00:00.000Z", title: "Film kasnije" })],
    { now: new Date("2026-07-21T17:00:00.000Z"), timeZone: "Europe/Podgorica" },
  );

  assert.equal(programme.day, "none");
  assert.deepEqual(programme.events, []);
});

function cinemaEvent({ id, startsAt, title }: { id: string; startsAt: string; title: string }) {
  return {
    category: "movie" as const,
    cityId: "podgorica" as const,
    cityIds: ["podgorica" as const],
    id,
    language: "me" as const,
    sourceId: "cineplexx-podgorica",
    sourceName: "Cineplexx Podgorica",
    sourceReferences: [],
    sourceUrl: `https://www.cineplexx.me/purchase/wizard/${id}`,
    startsAt,
    status: "scheduled" as const,
    tags: [`movie:https://www.cineplexx.me/film/${id}`],
    timezone: "Europe/Podgorica",
    title,
  };
}
