import assert from "node:assert/strict";
import test from "node:test";

import {
  getCineplexxProgrammeDisplayState,
  groupCineplexxProgramme,
} from "./cineplexx-programme-ui-model.ts";

test("distinguishes Cineplexx empty, unavailable, fresh, and stale programme states", () => {
  assert.equal(getCineplexxProgrammeDisplayState({ eventCount: 0, providerState: "fresh" }), "empty");
  assert.equal(
    getCineplexxProgrammeDisplayState({ eventCount: 0, providerState: "unavailable" }),
    "unavailable",
  );
  assert.equal(getCineplexxProgrammeDisplayState({ eventCount: 2, providerState: "fresh" }), "programme");
  assert.equal(getCineplexxProgrammeDisplayState({ eventCount: 2, providerState: "stale" }), "stale");
});

test("groups same-day screenings of one Cineplexx movie without merging another movie", () => {
  const grouped = groupCineplexxProgramme([
    cinemaEvent({ id: "one", startsAt: "2026-07-20T14:20:00.000Z", title: "Film" }),
    cinemaEvent({ id: "two", startsAt: "2026-07-20T16:30:00.000Z", title: "Film" }),
    cinemaEvent({ id: "three", startsAt: "2026-07-20T16:30:00.000Z", title: "Drugi film" }),
  ]);

  assert.deepEqual(grouped.map(({ screenings, title }) => ({ count: screenings.length, title })), [
    { count: 2, title: "Film" },
    { count: 1, title: "Drugi film" },
  ]);
});

function cinemaEvent({ id, startsAt, title }: { id: string; startsAt: string; title: string }) {
  return {
    category: "movie" as const,
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
