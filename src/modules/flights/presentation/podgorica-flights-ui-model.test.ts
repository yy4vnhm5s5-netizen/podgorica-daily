import assert from "node:assert/strict";
import test from "node:test";

import type { Flight } from "../domain/flight.ts";
import {
  getDisplayableFlightFact,
  getAirportFlightGroups,
  getAirportFlightsDisplayState,
  getAirportFlightsUpdatedLabel,
  getUpcomingAirportFlightGroups,
} from "./podgorica-flights-ui-model.ts";

test("suppresses blank and placeholder optional flight facts", () => {
  for (const value of [undefined, null, "", "  ", "-", " – ", "—"]) {
    assert.equal(getDisplayableFlightFact(value), undefined);
  }
});

test("keeps meaningful optional flight facts without changing required flight values", () => {
  const podgoricaFlight: Flight = {
    direction: "arrival",
    flightNumber: "JU663",
    location: "Beograd",
    scheduledAt: "2026-08-10T08:35:00.000Z",
    scheduledDate: "2026-08-10",
    scheduledTime: "10:35",
    status: "Arrived",
  };
  const tivatFlight: Flight = {
    airline: " Air Serbia ",
    direction: "arrival",
    flightNumber: "JU 683",
    location: "Beograd",
    scheduledAt: "2026-08-10T08:35:00.000Z",
    scheduledDate: "2026-08-10",
    scheduledTime: "10:35",
    status: " Poletio ",
  };

  assert.equal(getDisplayableFlightFact(podgoricaFlight.airline), undefined);
  assert.equal(getDisplayableFlightFact(podgoricaFlight.status), "Arrived");
  assert.equal(getDisplayableFlightFact(tivatFlight.airline), "Air Serbia");
  assert.equal(getDisplayableFlightFact(tivatFlight.status), "Poletio");
  assert.equal(podgoricaFlight.flightNumber, "JU663");
  assert.equal(tivatFlight.flightNumber, "JU 683");
  assert.equal(podgoricaFlight.location, "Beograd");
  assert.equal(tivatFlight.scheduledTime, "10:35");
});

test("distinguishes fresh, stale, stale-empty, and unavailable flight display states", () => {
  assert.equal(getAirportFlightsDisplayState({ flightCount: 3, state: "fresh" }), "flights");
  assert.equal(getAirportFlightsDisplayState({ flightCount: 3, state: "stale" }), "stale");
  assert.equal(getAirportFlightsDisplayState({ flightCount: 0, state: "fresh" }), "empty");
  assert.equal(getAirportFlightsDisplayState({ flightCount: 0, state: "stale" }), "stale-empty");
  assert.equal(
    getAirportFlightsDisplayState({ flightCount: 0, state: "unavailable" }),
    "unavailable",
  );
  assert.equal(
    getAirportFlightsDisplayState({ flightCount: 3, state: "unavailable" }),
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

  const allGroups = getAirportFlightGroups(flights);
  const upcomingGroups = getUpcomingAirportFlightGroups(
    flights,
    new Date("2026-07-22T08:30:00.000Z"),
    1,
  );
  const pageGroups = getUpcomingAirportFlightGroups(
    flights,
    new Date("2026-07-22T08:30:00.000Z"),
    5,
  );
  const homepageGroups = getUpcomingAirportFlightGroups(
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
    getAirportFlightsUpdatedLabel({
      lastSuccessfulRefreshAt: "2026-07-22T09:52:00.000Z",
      locale: "me",
      now,
    }),
    "Ažurirano prije 8 minuta",
  );
  assert.equal(
    getAirportFlightsUpdatedLabel({
      lastSuccessfulRefreshAt: "2026-07-22T08:00:00.000Z",
      locale: "en",
      now,
    }),
    "Updated 2 hours ago",
  );
  assert.equal(
    getAirportFlightsUpdatedLabel({
      lastSuccessfulRefreshAt: "not-a-date",
      locale: "me",
      now,
    }),
    undefined,
  );
});
