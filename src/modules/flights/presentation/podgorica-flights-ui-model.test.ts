import assert from "node:assert/strict";
import test from "node:test";

import type { Flight } from "../domain/flight.ts";
import {
  getPodgoricaFlightGroups,
  getPodgoricaFlightsDisplayState,
  getPodgoricaFlightsUpdatedLabel,
  getUpcomingPodgoricaFlightGroups,
} from "./podgorica-flights-ui-model.ts";

test("distinguishes available, empty, stale, and unavailable flight card states", () => {
  assert.equal(getPodgoricaFlightsDisplayState({ flightCount: 3, state: "fresh" }), "flights");
  assert.equal(getPodgoricaFlightsDisplayState({ flightCount: 3, state: "stale" }), "stale");
  assert.equal(getPodgoricaFlightsDisplayState({ flightCount: 0, state: "fresh" }), "empty");
  assert.equal(
    getPodgoricaFlightsDisplayState({ flightCount: 0, state: "unavailable" }),
    "unavailable",
  );
});

test("groups and limits upcoming arrivals and departures consistently for the homepage and full schedule", () => {
  const flights: Flight[] = [
    flight("arrival", "Istanbul", "2026-07-22T09:40:00.000Z"),
    flight("departure", "Beograd", "2026-07-22T08:25:00.000Z"),
    flight("arrival", "Beč", "2026-07-22T10:05:00.000Z"),
    flight("departure", "Rim", "2026-07-22T11:30:00.000Z"),
    flight("arrival", "Pariz", "2026-07-22T12:00:00.000Z"),
    flight("arrival", "London", "2026-07-22T13:00:00.000Z"),
    flight("arrival", "Berlin", "2026-07-22T14:00:00.000Z"),
    flight("arrival", "Madrid", "2026-07-22T15:00:00.000Z"),
    flight("arrival", "Rim", "2026-07-22T16:00:00.000Z"),
    flight("departure", "Beč", "2026-07-22T12:30:00.000Z"),
    flight("departure", "Pariz", "2026-07-22T13:30:00.000Z"),
    flight("departure", "London", "2026-07-22T14:30:00.000Z"),
    flight("departure", "Berlin", "2026-07-22T15:30:00.000Z"),
    flight("departure", "Madrid", "2026-07-22T16:30:00.000Z"),
  ];

  const allGroups = getPodgoricaFlightGroups(flights);
  const upcomingGroups = getUpcomingPodgoricaFlightGroups(
    flights,
    new Date("2026-07-22T08:30:00.000Z"),
    1,
  );
  const pageGroups = getUpcomingPodgoricaFlightGroups(
    flights,
    new Date("2026-07-22T08:30:00.000Z"),
    5,
  );
  const homepageGroups = getUpcomingPodgoricaFlightGroups(
    flights,
    new Date("2026-07-22T08:30:00.000Z"),
    3,
  );

  assert.deepEqual(
    allGroups.arrival.map(({ location }) => location),
    ["Istanbul", "Beč", "Pariz", "London", "Berlin", "Madrid", "Rim"],
  );
  assert.deepEqual(
    allGroups.departure.map(({ location }) => location),
    ["Beograd", "Rim", "Beč", "Pariz", "London", "Berlin", "Madrid"],
  );
  assert.deepEqual(
    upcomingGroups.arrival.map(({ location }) => location),
    ["Istanbul"],
  );
  assert.deepEqual(
    upcomingGroups.departure.map(({ location }) => location),
    ["Rim"],
  );
  assert.equal(pageGroups.arrival.length, 5);
  assert.equal(pageGroups.departure.length, 5);
  assert.equal(homepageGroups.arrival.length, 3);
  assert.equal(homepageGroups.departure.length, 3);
});

function flight(direction: Flight["direction"], location: string, scheduledAt: string): Flight {
  return {
    direction,
    location,
    scheduledAt,
    scheduledDate: "2026-07-22",
    scheduledTime: scheduledAt.slice(11, 16),
  };
}

test("uses only the last successful cache refresh for a localized update label", () => {
  const now = new Date("2026-07-22T10:00:00.000Z");

  assert.equal(
    getPodgoricaFlightsUpdatedLabel({
      lastSuccessfulRefreshAt: "2026-07-22T09:52:00.000Z",
      locale: "me",
      now,
    }),
    "Ažurirano prije 8 minuta",
  );
  assert.equal(
    getPodgoricaFlightsUpdatedLabel({
      lastSuccessfulRefreshAt: "2026-07-22T08:00:00.000Z",
      locale: "en",
      now,
    }),
    "Updated 2 hours ago",
  );
  assert.equal(
    getPodgoricaFlightsUpdatedLabel({
      lastSuccessfulRefreshAt: "not-a-date",
      locale: "me",
      now,
    }),
    undefined,
  );
});
