import assert from "node:assert/strict";
import test from "node:test";

import {
  getBusStationConfig,
  normalizeBusStationDeparture,
  selectUpcomingBusStationDepartures,
} from "./bus-station.ts";
import { getCity } from "../../../shared/config/cities.ts";

test("configures the confirmed Podgorica BusTicket4.me station", () => {
  assert.deepEqual(getBusStationConfig(getCity("podgorica")), {
    cityName: "Podgorica",
    citySlug: "podgorica",
    provider: "busticket4me",
    stationId: "1121",
    stationUrl: "https://busticket4.me/mne/bus-station/details/podgorica?station_id=1121",
    timezone: "Europe/Podgorica",
  });
  assert.equal(getBusStationConfig(getCity("bar")), undefined);
});

test("normalizes a complete departure candidate without inventing fields", () => {
  assert.deepEqual(
    normalizeBusStationDeparture({
      departureAt: "2026-07-19T20:30:00+02:00",
      destination: "  Nikšić  ",
      platform: "4",
    }),
    {
      departureAt: "2026-07-19T18:30:00.000Z",
      destination: "Nikšić",
      platform: "4",
    },
  );
  assert.equal(
    normalizeBusStationDeparture({ departureAt: "invalid", destination: "Bar" }),
    undefined,
  );
  assert.equal(
    normalizeBusStationDeparture({ departureAt: "2026-07-19T20:30", destination: "Bar" }),
    undefined,
  );
  assert.equal(
    normalizeBusStationDeparture({ departureAt: "2026-07-19T20:30:00+02:00", destination: " " }),
    undefined,
  );
});

test("selects at most three sorted future departures across the local day boundary", () => {
  const departures = [
    { departureAt: "2026-10-25T00:10:00+02:00", destination: "Bar" },
    { departureAt: "2026-10-24T23:50:00+02:00", destination: "Budva" },
    { departureAt: "2026-10-25T01:20:00+02:00", destination: "Nikšić" },
    { departureAt: "2026-10-25T02:30:00+01:00", destination: "Kotor" },
    { departureAt: "2026-10-25T03:30:00+01:00", destination: "Herceg Novi" },
  ];

  assert.deepEqual(
    selectUpcomingBusStationDepartures(departures, new Date("2026-10-24T22:00:00.000Z")).map(
      ({ destination }) => destination,
    ),
    ["Bar", "Nikšić", "Kotor"],
  );
});

test("keeps the fallback state empty when no verified departures are available", () => {
  assert.deepEqual(selectUpcomingBusStationDepartures(undefined), []);
  assert.deepEqual(
    selectUpcomingBusStationDepartures(
      [{ departureAt: "2026-07-19T18:00:00.000Z", destination: "Bar" }],
      new Date("2026-07-19T18:00:01.000Z"),
    ),
    [],
  );
});
