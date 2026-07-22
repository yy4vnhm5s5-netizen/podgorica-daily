import assert from "node:assert/strict";
import test from "node:test";

import { canReadGoingOutEvents, getGoingOutEvents } from "./get-going-out-events.ts";
import { createCityContext } from "@/shared/config/cities";

test("does not read the going-out cache for a city without going-out capability", async () => {
  const podgorica = createCityContext("podgorica");
  const context = { ...podgorica, city: { ...podgorica.city, capabilities: [] } };
  assert.equal(canReadGoingOutEvents(context), false);
  const result = await getGoingOutEvents(context);

  assert.deepEqual(result, { events: [], state: "unavailable" });
});

test("allows the going-out cache only for a city with going-out capability", () => {
  const context = createCityContext("podgorica");
  assert.equal(canReadGoingOutEvents(context), true);
});
