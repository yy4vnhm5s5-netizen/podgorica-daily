import assert from "node:assert/strict";
import test from "node:test";
import { eventProviderRegistry, getEnabledEventProviders } from "./event-provider-registry.ts";
import { tivatTourismEventProvider } from "./tivat-tourism-event-provider.ts";
import { tourismEventProvider } from "./tourism-event-provider.ts";
import { createCityContext } from "@/shared/config/cities";

test("registers Tivat Tourism only through the live registry, alongside every other events provider", () => {
  assert.equal(tivatTourismEventProvider.metadata.id, "tourism-tivat");
  assert.deepEqual(tivatTourismEventProvider.metadata.supportedCityIds, ["tivat"]);
  assert.equal(
    getEnabledEventProviders({ ENABLE_EVENTS: false, EVENT_PROVIDER_MODE: "live" }).length,
    0,
  );
  assert.equal(
    getEnabledEventProviders({ ENABLE_EVENTS: true, EVENT_PROVIDER_MODE: "mock" }).length,
    0,
  );
  assert.ok(
    getEnabledEventProviders({ ENABLE_EVENTS: true, EVENT_PROVIDER_MODE: "live" }).includes(
      tivatTourismEventProvider,
    ),
  );
  assert.ok(eventProviderRegistry.some((provider) => provider.metadata.id === "tourism-tivat"));
});

test("Tivat Tourism and Podgorica Tourism providers self-filter and never cross-contaminate each other's city", async () => {
  const podgorica = createCityContext("podgorica");
  const tivat = createCityContext("tivat");

  const tivatProviderForPodgorica = await tivatTourismEventProvider.getCachedEvents(podgorica);
  assert.equal(tivatProviderForPodgorica.state, "disabled");
  assert.deepEqual(tivatProviderForPodgorica.events, []);

  const podgoricaProviderForTivat = await tourismEventProvider.getCachedEvents(tivat);
  assert.equal(podgoricaProviderForTivat.state, "disabled");
  assert.deepEqual(podgoricaProviderForTivat.events, []);
});
