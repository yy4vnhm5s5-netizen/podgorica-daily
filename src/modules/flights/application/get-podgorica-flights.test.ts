import assert from "node:assert/strict";
import test from "node:test";

import { canReadPodgoricaFlights, getPodgoricaFlights } from "./get-podgorica-flights.ts";
import { createCityContext } from "@/shared/config/cities";

test("does not read the flight cache for a city without flight capability", async () => {
  const podgorica = createCityContext("podgorica");
  const context = { ...podgorica, city: { ...podgorica.city, capabilities: [] } };

  assert.equal(canReadPodgoricaFlights(context), false);
  const result = await getPodgoricaFlights(context);
  assert.deepEqual(result, { flights: [], state: "unavailable" });
});

test("allows the flight cache only for a city with flight capability", () => {
  const context = createCityContext("podgorica");
  assert.equal(canReadPodgoricaFlights(context), true);
});
