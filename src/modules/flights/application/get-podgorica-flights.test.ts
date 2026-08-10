import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { canReadAirportFlights, getAirportFlights } from "./get-podgorica-flights.ts";
import { createCityContext } from "@/shared/config/cities";

test("does not read the flight cache for a city without flight capability", async () => {
  const podgorica = createCityContext("podgorica");
  const context = { ...podgorica, city: { ...podgorica.city, capabilities: [] } };

  assert.equal(canReadAirportFlights(context), false);
  const result = await getAirportFlights(context);
  assert.deepEqual(result, { flights: [], state: "unavailable" });
});

test("allows the flight cache only for a city with flight capability", () => {
  const context = createCityContext("podgorica");
  assert.equal(canReadAirportFlights(context), true);
});

test("does not read Podgorica's cache for a differently-identified city, even with flight capability", async () => {
  // Regression test: the airport query must never read Podgorica's cache for another city.
  // regardless of context.city, so any other city with the "flights" capability would have
  // silently displayed Podgorica's flights instead of its own (or none at all).
  const podgorica = createCityContext("podgorica");
  const context = {
    ...podgorica,
    city: { ...podgorica.city, capabilities: ["flights" as const], id: "unverified-airport-city" },
  };

  const result = await getAirportFlights(context);
  assert.deepEqual(result, { flights: [], state: "unavailable" });
});

test("Tivat reads its own airport cache through the same cache-only application query", () => {
  const context = createCityContext("tivat");
  assert.equal(canReadAirportFlights(context), true);
});

test("the public airport query remains cache-only and does not invoke a visitor-side refresh", async () => {
  const source = await readFile(new URL("./get-podgorica-flights.ts", import.meta.url), "utf8");

  assert.match(source, /getCachedAirportFlights\(getFlightsCachePath\(context\.city\.id\)\)/u);
  assert.doesNotMatch(source, /refreshAirportFlights|createAirportFlightsHttpClient|\bfetch\s*\(/u);
});
