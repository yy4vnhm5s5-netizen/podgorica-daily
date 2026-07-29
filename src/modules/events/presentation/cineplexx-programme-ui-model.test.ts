import assert from "node:assert/strict";
import test from "node:test";

import {
  getCineplexxProgrammeDisplayState,
  groupCineplexxProgramme,
  selectHomepageCinemaProgramme,
  selectMoviesWithUpcomingScreenings,
  selectUpcomingCineplexxScreenings,
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

test("counts distinct movies in a screening list instead of individual screenings", () => {
  const events = [
    cinemaEvent({ id: "one", startsAt: "2026-07-20T14:20:00.000Z", title: "Film" }),
    cinemaEvent({ id: "two", startsAt: "2026-07-20T16:30:00.000Z", title: "Film" }),
    cinemaEvent({ id: "three", startsAt: "2026-07-20T16:30:00.000Z", title: "Drugi film" }),
  ];

  assert.equal(groupCineplexxProgramme(events).length, 2);
});

// Regression test for the /podgorica vs /podgorica/filmovi movie-count mismatch: a movie playing
// on several different days must still be one unique movie, not one group per day it screens.
test("counts a movie playing across multiple days as one unique movie, not one group per day", () => {
  const events = [
    cinemaEvent({ id: "today-1", startsAt: "2026-07-20T14:20:00.000Z", title: "Film" }),
    cinemaEvent({ id: "tomorrow-1", startsAt: "2026-07-21T14:20:00.000Z", title: "Film" }),
    cinemaEvent({ id: "later-1", startsAt: "2026-07-23T18:00:00.000Z", title: "Film" }),
    cinemaEvent({ id: "other", startsAt: "2026-07-21T16:30:00.000Z", title: "Drugi film" }),
  ];

  const movies = selectMoviesWithUpcomingScreenings(events, {
    now: new Date("2026-07-20T00:00:00.000Z"),
  });

  assert.equal(movies.length, 2);
  const film = movies.find((movie) => movie.title === "Film");
  assert.equal(film?.screenings.length, 3);
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

test("counts no movies when all cached Cineplexx screenings have elapsed", () => {
  const programme = selectHomepageCinemaProgramme(
    [cinemaEvent({ id: "past", startsAt: "2026-07-21T15:00:00.000Z", title: "Raniji film" })],
    { now: new Date("2026-07-21T17:00:00.000Z"), timeZone: "Europe/Podgorica" },
  );

  assert.equal(programme.day, "none");
  assert.equal(groupCineplexxProgramme(programme.events).length, 0);
});

test("counts only distinct movies in the currently displayable programme", () => {
  const programme = selectHomepageCinemaProgramme(
    [
      cinemaEvent({ id: "past", startsAt: "2026-07-21T15:00:00.000Z", title: "Prošli film" }),
      cinemaEvent({ id: "first", startsAt: "2026-07-21T18:30:00.000Z", title: "Film danas" }),
      cinemaEvent({ id: "second", startsAt: "2026-07-21T20:30:00.000Z", title: "Film danas" }),
      cinemaEvent({ id: "tomorrow", startsAt: "2026-07-22T12:00:00.000Z", title: "Film sjutra" }),
    ],
    { now: new Date("2026-07-21T17:00:00.000Z"), timeZone: "Europe/Podgorica" },
  );

  assert.equal(programme.day, "today");
  assert.equal(groupCineplexxProgramme(programme.events).length, 1);
});

test("uses the empty state only when neither today nor tomorrow has a remaining screening", () => {
  const programme = selectHomepageCinemaProgramme(
    [cinemaEvent({ id: "later", startsAt: "2026-07-23T12:00:00.000Z", title: "Film kasnije" })],
    { now: new Date("2026-07-21T17:00:00.000Z"), timeZone: "Europe/Podgorica" },
  );

  assert.equal(programme.day, "none");
  assert.deepEqual(programme.events, []);
});

test("excludes past screenings from the unique-movie selection used by both the homepage and the movies page", () => {
  const now = new Date("2026-07-21T17:00:00.000Z");
  const events = [
    cinemaEvent({ id: "past-1", startsAt: "2026-07-20T15:00:00.000Z", title: "Prošli film" }),
    cinemaEvent({
      id: "past-2",
      startsAt: "2026-07-21T10:00:00.000Z",
      title: "Drugi prošli film",
    }),
    cinemaEvent({ id: "future", startsAt: "2026-07-22T12:00:00.000Z", title: "Budući film" }),
  ];

  const movies = selectMoviesWithUpcomingScreenings(events, { now });

  assert.deepEqual(
    movies.map((movie) => movie.title),
    ["Budući film"],
  );
});

// Product decision (confirmed): a screening that has already started is not "available" to a
// visitor opening the site right now, even though the film is still playing in the hall — no
// endsAt/duration/grace-period is used. Only a movie with at least one *other*, still-upcoming
// screening keeps counting.
test("a screening that started 30 minutes ago does not count, even though the film is still playing", () => {
  const now = new Date("2026-07-21T18:30:00.000Z");
  const events = [
    cinemaEvent({ id: "in-progress", startsAt: "2026-07-21T18:00:00.000Z", title: "Film" }),
  ];

  const movies = selectMoviesWithUpcomingScreenings(events, { now });

  assert.deepEqual(movies, []);
});

test("counts the same movie once when it has one past and one future screening", () => {
  const now = new Date("2026-07-21T18:30:00.000Z");
  const events = [
    cinemaEvent({ id: "started", startsAt: "2026-07-21T18:00:00.000Z", title: "Film" }),
    cinemaEvent({ id: "later-today", startsAt: "2026-07-21T21:00:00.000Z", title: "Film" }),
  ];

  const movies = selectMoviesWithUpcomingScreenings(events, { now });

  assert.equal(movies.length, 1);
  // Only the still-upcoming screening remains in the group; the started one was filtered out
  // before grouping happened.
  assert.deepEqual(
    movies[0]?.screenings.map(({ id }) => id),
    ["later-today"],
  );
});

test("a movie whose every screening has already started is dropped entirely", () => {
  const now = new Date("2026-07-21T18:30:00.000Z");
  const events = [
    cinemaEvent({ id: "started-1", startsAt: "2026-07-21T14:00:00.000Z", title: "Film" }),
    cinemaEvent({ id: "started-2", startsAt: "2026-07-21T18:00:00.000Z", title: "Film" }),
  ];

  const movies = selectMoviesWithUpcomingScreenings(events, { now });

  assert.deepEqual(movies, []);
});

test("a screening starting at exactly `now` still counts (>= is inclusive)", () => {
  const now = new Date("2026-07-21T18:30:00.000Z");
  const events = [
    cinemaEvent({ id: "right-now", startsAt: "2026-07-21T18:30:00.000Z", title: "Film" }),
  ];

  const screenings = selectUpcomingCineplexxScreenings(events, { now });
  const movies = selectMoviesWithUpcomingScreenings(events, { now });

  assert.deepEqual(
    screenings.map(({ id }) => id),
    ["right-now"],
  );
  assert.equal(movies.length, 1);
});

test("excludes cancelled and postponed screenings from the unique-movie count, even with a future start time", () => {
  const now = new Date("2026-07-21T17:00:00.000Z");
  const events = [
    {
      ...cinemaEvent({
        id: "cancelled",
        startsAt: "2026-07-22T12:00:00.000Z",
        title: "Otkazan film",
      }),
      status: "cancelled" as const,
    },
    {
      ...cinemaEvent({
        id: "postponed",
        startsAt: "2026-07-22T14:00:00.000Z",
        title: "Odgođen film",
      }),
      status: "postponed" as const,
    },
    cinemaEvent({ id: "kept", startsAt: "2026-07-22T16:00:00.000Z", title: "Aktuelan film" }),
  ];

  const movies = selectMoviesWithUpcomingScreenings(events, { now });

  assert.deepEqual(
    movies.map((movie) => movie.title),
    ["Aktuelan film"],
  );
});

test("returns zero movies for an empty event list without error", () => {
  const now = new Date("2026-07-21T17:00:00.000Z");

  assert.deepEqual(selectUpcomingCineplexxScreenings([], { now }), []);
  assert.deepEqual(selectMoviesWithUpcomingScreenings([], { now }), []);
  assert.equal(selectMoviesWithUpcomingScreenings([], { now }).length, 0);
});

// The homepage highlight count (platform-homepage-data.ts) and the /filmovi listing page
// (CineplexxProgrammeCard fed with no `limit`) both resolve to groupCineplexxProgramme applied to
// selectUpcomingCineplexxScreenings — this proves that composition is deterministic and gives the
// same movie count as selectMoviesWithUpcomingScreenings for the same input, so the two pages cannot
// disagree as long as they both keep using this shared selector.
test("the homepage movie count and the movies-page movie list agree for the same event set", () => {
  const now = new Date("2026-07-21T17:00:00.000Z");
  const events = [
    cinemaEvent({ id: "past", startsAt: "2026-07-21T10:00:00.000Z", title: "Prošli film" }),
    cinemaEvent({ id: "today-a", startsAt: "2026-07-21T18:00:00.000Z", title: "Film A" }),
    cinemaEvent({ id: "today-a-2", startsAt: "2026-07-21T20:00:00.000Z", title: "Film A" }),
    cinemaEvent({ id: "tomorrow-b", startsAt: "2026-07-22T12:00:00.000Z", title: "Film B" }),
    cinemaEvent({ id: "later-c", startsAt: "2026-07-24T12:00:00.000Z", title: "Film C" }),
  ];

  // What platform-homepage-data.ts now computes for the "Filmovi" highlight value.
  const homepageMovieCount = selectMoviesWithUpcomingScreenings(events, { now }).length;
  // What /filmovi now renders: CineplexxProgrammeCard groups selectUpcomingCineplexxScreenings
  // with no limit, i.e. every group is shown.
  const moviesPageMovieList = groupCineplexxProgramme(
    selectUpcomingCineplexxScreenings(events, { now }),
  );

  assert.equal(homepageMovieCount, 3);
  assert.equal(moviesPageMovieList.length, homepageMovieCount);
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
    // Mirrors the real Cineplexx parser: it parses the movie-detail-page URL once per movie
    // block and reuses that same tag for every screening of that movie (cineplexx-programme-
    // parser.ts), so two fixture events sharing a title get the same tag here too — matching
    // production identity instead of the per-screening booking URL used for sourceUrl above.
    tags: [`movie:https://www.cineplexx.me/film/${encodeURIComponent(title.toLocaleLowerCase())}`],
    timezone: "Europe/Podgorica",
    title,
  };
}
