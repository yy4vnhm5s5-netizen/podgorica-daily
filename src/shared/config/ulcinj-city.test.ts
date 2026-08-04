import assert from "node:assert/strict";
import test from "node:test";

import { getActiveCities, getCity, getCityBySlug, getCityName } from "./cities.ts";
import { isCedisSupportedCityId } from "@/modules/city-alerts/infrastructure/cedis-cities";
import { vikUlcinjProviderMetadata } from "@/modules/city-alerts/infrastructure/vik-ulcinj";
import { isCityPublicFeatureRouteAvailable } from "./city-routes.ts";
import {
  getCityPath,
  getElectricityPath,
  getEventsPath,
  getFlightsPath,
  getGoingOutPath,
  getSeaWaterQualityPath,
} from "./public-routes.ts";

const requireUlcinj = () => {
  const ulcinj = getCity("ulcinj");
  assert.ok(ulcinj, "Ulcinj must exist in the registry");
  return ulcinj;
};

test("registers Ulcinj as an active, non-main coastal city", () => {
  const ulcinj = requireUlcinj();

  assert.equal(ulcinj.isActive, true);
  assert.equal(ulcinj.isMain, false);
  assert.equal(ulcinj.slug, "ulcinj");
  assert.equal(ulcinj.country, "Montenegro");
  assert.equal(ulcinj.timezone, "Europe/Podgorica");
  assert.equal(getCityBySlug("ulcinj")?.id, "ulcinj");
  assert.equal(
    getActiveCities().some((city) => city.id === "ulcinj"),
    true,
  );
});

test("carries all four verified grammatical forms", () => {
  const ulcinj = requireUlcinj();

  assert.equal(getCityName(ulcinj), "Ulcinj");
  assert.equal(getCityName(ulcinj, "nominative"), "Ulcinj");
  assert.equal(getCityName(ulcinj, "genitive"), "Ulcinja");
  // Masculine inanimate: the accusative matches the nominative, like Bar and Kotor.
  assert.equal(getCityName(ulcinj, "accusative"), "Ulcinj");
  assert.equal(getCityName(ulcinj, "locative"), "Ulcinju");
});

test("declares only the capabilities backed by a verified source", () => {
  const ulcinj = requireUlcinj();

  assert.deepEqual([...(ulcinj.capabilities ?? [])].sort(), [
    "electricity",
    "goingOut",
    "seaWaterQuality",
    "water",
    "weather",
  ]);
  // Water is declared only because the ViK Ulcinj provider now covers the city; the City Services
  // Voda tab is derived from this capability alone, so it must never be declared ahead of a
  // provider that can answer for it.
  assert.equal(
    vikUlcinjProviderMetadata.supportedCityIds?.includes("ulcinj"),
    true,
    "the water capability requires a provider that declares Ulcinj",
  );
  // Electricity followed the same rule as water: declared only once CEDIS was shown to publish a
  // recognizable Ulcinj municipality section, which the shared parser already resolves.
  assert.equal(isCedisSupportedCityId("ulcinj"), true);
});

test("exposes exactly the supported public routes and no others", () => {
  const ulcinj = requireUlcinj();

  for (const capability of ["goingOut", "seaWaterQuality"] as const) {
    assert.equal(isCityPublicFeatureRouteAvailable(ulcinj, capability), true, capability);
  }
  assert.equal(isCityPublicFeatureRouteAvailable(ulcinj, "electricity"), true);
  assert.equal(getElectricityPath(ulcinj), "/ulcinj/struja");
  for (const capability of ["events", "flights", "railway"] as const) {
    assert.equal(isCityPublicFeatureRouteAvailable(ulcinj, capability), false, capability);
  }
  // Water is deliberately absent from both lists: the platform has no standalone water route, so
  // the capability adds a City Services tab and no page at all. sitemap.test.ts pins that no
  // /ulcinj/voda URL is ever emitted.
  assert.equal(getCityPath(ulcinj), "/ulcinj");
  assert.equal(getSeaWaterQualityPath(ulcinj), "/ulcinj/plaze");
  assert.equal(getGoingOutPath(ulcinj), "/ulcinj/izlasci");
  // These helpers still build strings; availability above is what keeps them unreachable.
  assert.equal(getEventsPath(ulcinj), "/ulcinj/dogadjaji");
  assert.equal(getFlightsPath(ulcinj), "/ulcinj/letovi");
});

test("produces grammatical Ulcinj copy from the registry, never a hardcoded form", () => {
  const ulcinj = requireUlcinj();

  assert.equal(
    `Plaže u ${getCityName(ulcinj, "locative")} i kvalitet mora`,
    "Plaže u Ulcinju i kvalitet mora",
  );
  assert.equal(`Izlasci u ${getCityName(ulcinj, "locative")}`, "Izlasci u Ulcinju");
  assert.equal(`Letovi iz ${getCityName(ulcinj, "genitive")}`, "Letovi iz Ulcinja");
  assert.equal(
    `Sve informacije za ${getCityName(ulcinj, "accusative")}`,
    "Sve informacije za Ulcinj",
  );
});
