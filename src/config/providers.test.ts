import assert from "node:assert/strict";
import test from "node:test";

import { getCityAlertProviderData, providerRegistry } from "./providers.ts";
import { createCityContext } from "@/shared/config/cities";

test("registers only supported City Alerts providers", () => {
  assert.deepEqual(
    providerRegistry.map(({ id }) => id),
    ["cedis", "vikpg", "vodovod-kotor", "vik-ulcinj", "weather"],
  );
});

// Every water-capable city must reach a provider that actually declares it, through the one shared
// dispatch — no city is named anywhere in the presentation layer.
test("routes each water-capable city to the provider that covers it", async () => {
  const providerIdFor = async (cityId: "kotor" | "podgorica" | "ulcinj") => {
    const [, water] = await getCityAlertProviderData(createCityContext(cityId, "me"), ["water"]);
    return water?.providerId;
  };

  assert.equal(await providerIdFor("ulcinj"), "vik-ulcinj");
  // Unchanged by the Ulcinj addition.
  assert.equal(await providerIdFor("kotor"), "vodovod-kotor");
  assert.equal(await providerIdFor("podgorica"), "vikpg");
});

test("asks for no water provider when the city has no water capability", async () => {
  const [, water] = await getCityAlertProviderData(createCityContext("ulcinj", "me"), []);

  assert.equal(water, undefined);
});
