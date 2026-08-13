import assert from "node:assert/strict";
import test from "node:test";

import { loadCityDashboardData } from "./city-dashboard-data.ts";
import { getEmptyCityEventsReadModel } from "@/modules/events/application/get-city-events";
import { createCityContext } from "@/shared/config/cities";
import type { CityContext } from "@/shared/types/city";

test("dashboard loader avoids unsupported city queries before cache access", async () => {
  const podgorica = createCityContext("podgorica");
  const context = { ...podgorica, city: { ...podgorica.city, capabilities: [] } };
  const calls = { flights: 0, goingOut: 0, parking: 0, railway: 0, weather: 0 };

  const result = await loadCityDashboardData(context, {
    async getCityEvents() {
      throw new Error("events must not load");
    },
    async getCurrentWeather() {
      calls.weather += 1;
      return { status: "empty" };
    },
    async getGoingOutEvents() {
      calls.goingOut += 1;
      return { events: [], state: "unavailable" };
    },
    async getAirportFlights() {
      calls.flights += 1;
      return { flights: [], state: "unavailable" };
    },
    async getParkingAvailability() {
      calls.parking += 1;
      return { locations: [], state: "unavailable" };
    },
    async getRailwayDepartures() {
      calls.railway += 1;
      return { departures: [], state: "unavailable" };
    },
    isFeatureEnabled() {
      return true;
    },
  });

  assert.equal(result.events.events.length, getEmptyCityEventsReadModel().events.length);
  assert.deepEqual(calls, { flights: 0, goingOut: 0, parking: 0, railway: 0, weather: 0 });
});

test("dashboard loader calls every capability-supported query for Podgorica", async () => {
  const context = createCityContext("podgorica");
  const calls = { events: 0, flights: 0, goingOut: 0, parking: 0, railway: 0, weather: 0 };

  await loadCityDashboardData(context, {
    async getCityEvents() {
      calls.events += 1;
      return getEmptyCityEventsReadModel();
    },
    async getCurrentWeather() {
      calls.weather += 1;
      return { status: "empty" };
    },
    async getGoingOutEvents() {
      calls.goingOut += 1;
      return { events: [], state: "unavailable" };
    },
    async getAirportFlights() {
      calls.flights += 1;
      return { flights: [], state: "unavailable" };
    },
    async getParkingAvailability() {
      calls.parking += 1;
      return { locations: [], state: "unavailable" };
    },
    async getRailwayDepartures() {
      calls.railway += 1;
      return { departures: [], state: "unavailable" };
    },
    isFeatureEnabled() {
      return true;
    },
  });

  assert.deepEqual(calls, {
    events: 1,
    flights: 1,
    goingOut: 1,
    parking: 1,
    railway: 1,
    weather: 1,
  });
});

test("dashboard loader includes the shared Flights query for Tivat", async () => {
  const context = createCityContext("tivat");
  const calls = { flights: 0, parking: 0 };

  await loadCityDashboardData(context, {
    async getAirportFlights() {
      calls.flights += 1;
      return { flights: [], state: "unavailable" };
    },
    async getParkingAvailability() {
      calls.parking += 1;
      return { locations: [], state: "unavailable" };
    },
    async getCityEvents() {
      return getEmptyCityEventsReadModel();
    },
    async getCurrentWeather() {
      return { status: "empty" };
    },
    async getGoingOutEvents() {
      return { events: [], state: "unavailable" };
    },
    async getRailwayDepartures() {
      return { departures: [], state: "unavailable" };
    },
    isFeatureEnabled() {
      return true;
    },
  });

  assert.deepEqual(calls, { flights: 1, parking: 0 });
});

test("dashboard loader respects the Parking feature flag before reading its public cache", async () => {
  const context = createCityContext("podgorica");
  let parkingCalls = 0;

  const result = await loadCityDashboardData(context, {
    async getParkingAvailability() {
      parkingCalls += 1;
      return { locations: [], state: "unavailable" };
    },
    isFeatureEnabled(feature) {
      return feature !== "parking";
    },
  });

  assert.equal(parkingCalls, 0);
  assert.equal(result.parking, null);
});

test("dashboard loader can skip unused platform-card snapshots without skipping other summaries", async () => {
  const podgorica = createCityContext("podgorica");
  const context: CityContext = {
    ...podgorica,
    city: {
      ...podgorica.city,
      capabilities: [
        "events",
        "flights",
        "goingOut",
        "parking",
        "railway",
        "seaWaterQuality",
        "weather",
      ],
    },
  };
  const calls = {
    events: 0,
    flights: 0,
    goingOut: 0,
    parking: 0,
    railway: 0,
    seaWaterQuality: 0,
    weather: 0,
  };

  await loadCityDashboardData(
    context,
    {
      async getBudvaSeaWaterQuality() {
        calls.seaWaterQuality += 1;
        return { state: "fresh", summary: undefined };
      },
      async getCityEvents() {
        calls.events += 1;
        return getEmptyCityEventsReadModel();
      },
      async getCurrentWeather() {
        calls.weather += 1;
        return { status: "empty" };
      },
      async getGoingOutEvents() {
        calls.goingOut += 1;
        return { events: [], state: "unavailable" };
      },
      async getAirportFlights() {
        calls.flights += 1;
        return { flights: [], state: "unavailable" };
      },
      async getParkingAvailability() {
        calls.parking += 1;
        return { locations: [], state: "unavailable" };
      },
      async getRailwayDepartures() {
        calls.railway += 1;
        return { departures: [], state: "unavailable" };
      },
      isFeatureEnabled() {
        return true;
      },
    },
    { includeFlights: false, includeParking: false, includeRailway: false },
  );

  assert.deepEqual(calls, {
    events: 1,
    flights: 0,
    goingOut: 1,
    parking: 0,
    railway: 0,
    seaWaterQuality: 1,
    weather: 1,
  });
});

test("dashboard loader calls sea water quality for Kotor but not unsupported providers", async () => {
  const context = createCityContext("kotor");
  const calls = {
    events: 0,
    flights: 0,
    goingOut: 0,
    parking: 0,
    railway: 0,
    seaWaterQuality: 0,
    weather: 0,
  };

  await loadCityDashboardData(context, {
    async getBudvaSeaWaterQuality() {
      calls.seaWaterQuality += 1;
      return { state: "fresh", summary: undefined };
    },
    async getCityEvents() {
      calls.events += 1;
      return getEmptyCityEventsReadModel();
    },
    async getCurrentWeather() {
      calls.weather += 1;
      return { status: "empty" };
    },
    async getGoingOutEvents() {
      calls.goingOut += 1;
      return { events: [], state: "unavailable" };
    },
    async getAirportFlights() {
      calls.flights += 1;
      return { flights: [], state: "unavailable" };
    },
    async getParkingAvailability() {
      calls.parking += 1;
      return { locations: [], state: "unavailable" };
    },
    async getRailwayDepartures() {
      calls.railway += 1;
      return { departures: [], state: "unavailable" };
    },
    isFeatureEnabled() {
      return true;
    },
  });

  assert.deepEqual(calls, {
    events: 0,
    flights: 0,
    goingOut: 1,
    parking: 0,
    railway: 0,
    seaWaterQuality: 1,
    weather: 1,
  });
});

test("dashboard loader queries Bar's approved weather, Going Out, and sea-water data only", async () => {
  const context = createCityContext("bar");
  const calls = {
    events: 0,
    flights: 0,
    goingOut: 0,
    parking: 0,
    railway: 0,
    seaWaterQuality: 0,
    weather: 0,
  };

  await loadCityDashboardData(context, {
    async getBudvaSeaWaterQuality() {
      calls.seaWaterQuality += 1;
      return { state: "fresh", summary: undefined };
    },
    async getCityEvents() {
      calls.events += 1;
      return getEmptyCityEventsReadModel();
    },
    async getCurrentWeather() {
      calls.weather += 1;
      return { status: "empty" };
    },
    async getGoingOutEvents() {
      calls.goingOut += 1;
      return { events: [], state: "unavailable" };
    },
    async getAirportFlights() {
      calls.flights += 1;
      return { flights: [], state: "unavailable" };
    },
    async getParkingAvailability() {
      calls.parking += 1;
      return { locations: [], state: "unavailable" };
    },
    async getRailwayDepartures() {
      calls.railway += 1;
      return { departures: [], state: "unavailable" };
    },
    isFeatureEnabled() {
      return true;
    },
  });

  assert.deepEqual(calls, {
    events: 0,
    flights: 0,
    goingOut: 1,
    parking: 0,
    railway: 0,
    seaWaterQuality: 1,
    weather: 1,
  });
});

test("dashboard loader keeps other city data available when one highlight source fails", async () => {
  const context = createCityContext("podgorica");
  const events = getEmptyCityEventsReadModel();

  const result = await loadCityDashboardData(context, {
    async getCityEvents() {
      return events;
    },
    async getCurrentWeather() {
      throw new Error("weather upstream unavailable");
    },
    async getGoingOutEvents() {
      return { events: [], state: "unavailable" };
    },
    async getAirportFlights() {
      return { flights: [], state: "unavailable" };
    },
    async getParkingAvailability() {
      return { locations: [], state: "unavailable" };
    },
    async getRailwayDepartures() {
      return { departures: [], state: "unavailable" };
    },
    isFeatureEnabled() {
      return true;
    },
  });

  assert.equal(result.events, events);
  assert.equal(result.weather, null);
  assert.equal(result.flights?.state, "unavailable");
});
