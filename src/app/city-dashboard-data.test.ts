import assert from "node:assert/strict";
import test from "node:test";

import { loadCityDashboardData } from "./city-dashboard-data.ts";
import { getEmptyCityEventsReadModel } from "@/modules/events/application/get-city-events";
import { createCityContext } from "@/shared/config/cities";

test("dashboard loader avoids unsupported city queries before cache access", async () => {
  const podgorica = createCityContext("podgorica");
  const context = { ...podgorica, city: { ...podgorica.city, capabilities: [] } };
  const calls = { cityAlerts: 0, flights: 0, goingOut: 0, railway: 0 };

  const result = await loadCityDashboardData(context, {
    async getCityEvents() {
      throw new Error("events must not load");
    },
    async getCurrentWeather() {
      return { status: "empty" };
    },
    async getDailyOverview(_context, options) {
      calls.cityAlerts += options?.includeCityAlerts ? 1 : 0;
      return { status: "empty" };
    },
    async getGoingOutEvents() {
      calls.goingOut += 1;
      return { events: [], state: "unavailable" };
    },
    async getPodgoricaFlights() {
      calls.flights += 1;
      return { flights: [], state: "unavailable" };
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
  assert.deepEqual(calls, { cityAlerts: 0, flights: 0, goingOut: 0, railway: 0 });
});

test("dashboard loader calls every capability-supported query for Podgorica", async () => {
  const context = createCityContext("podgorica");
  const calls = { cityAlerts: 0, events: 0, flights: 0, goingOut: 0, railway: 0 };

  await loadCityDashboardData(context, {
    async getCityEvents() {
      calls.events += 1;
      return getEmptyCityEventsReadModel();
    },
    async getCurrentWeather() {
      return { status: "empty" };
    },
    async getDailyOverview(_context, options) {
      calls.cityAlerts += options?.includeCityAlerts ? 1 : 0;
      return { status: "empty" };
    },
    async getGoingOutEvents() {
      calls.goingOut += 1;
      return { events: [], state: "unavailable" };
    },
    async getPodgoricaFlights() {
      calls.flights += 1;
      return { flights: [], state: "unavailable" };
    },
    async getRailwayDepartures() {
      calls.railway += 1;
      return { departures: [], state: "unavailable" };
    },
    isFeatureEnabled() {
      return true;
    },
  });

  assert.deepEqual(calls, { cityAlerts: 1, events: 1, flights: 1, goingOut: 1, railway: 1 });
});
