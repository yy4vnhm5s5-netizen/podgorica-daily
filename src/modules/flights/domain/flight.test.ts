import assert from "node:assert/strict";
import test from "node:test";

import { normalizeFlight, selectUpcomingFlights, type Flight } from "./flight.ts";

test("normalizes Podgorica local flight times and keeps daylight-saving offsets", () => {
  const summerFlight = normalizeFlight({
    direction: "departure",
    location: "Beograd",
    scheduledDate: "2026-07-21",
    scheduledTime: "10:25",
  });
  const winterFlight = normalizeFlight({
    direction: "arrival",
    location: "Istanbul",
    scheduledDate: "2026-12-21",
    scheduledTime: "10:25",
  });

  assert.equal(summerFlight?.scheduledAt, "2026-07-21T08:25:00.000Z");
  assert.equal(winterFlight?.scheduledAt, "2026-12-21T09:25:00.000Z");
});

test("sorts and limits only future arrivals and departures", () => {
  const flights = [
    normalizeFlight({
      direction: "arrival",
      location: "Istanbul",
      scheduledDate: "2026-07-21",
      scheduledTime: "11:40",
    }),
    normalizeFlight({
      direction: "departure",
      location: "Beograd",
      scheduledDate: "2026-07-21",
      scheduledTime: "10:25",
    }),
    normalizeFlight({
      direction: "departure",
      location: "Beč",
      scheduledDate: "2026-07-21",
      scheduledTime: "13:05",
    }),
  ].filter((flight): flight is Flight => Boolean(flight));

  assert.deepEqual(
    selectUpcomingFlights(flights, new Date("2026-07-21T08:30:00.000Z"), 2).map(
      (flight) => flight.location,
    ),
    ["Istanbul", "Beč"],
  );
});
