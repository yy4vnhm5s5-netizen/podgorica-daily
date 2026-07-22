import assert from "node:assert/strict";
import test from "node:test";

import {
  getCanonicalCitySitemapPaths,
  getActiveCitySitemapPaths,
  getCityDashboardCapabilities,
  getCityLandingMetadata,
  getCityLandingTitle,
  getMainCityLandingContext,
  openGraphDescription,
  openGraphTitle,
  resolveActiveCityFeatureRoute,
  resolveActiveCityRoute,
} from "./city-routing.ts";
import { resolveCityContextCapability } from "@/config/city-context";
import { createCityContext } from "@/shared/config/cities";
import type { City } from "@/shared/types/city";

function city(overrides: Partial<City> = {}): City {
  return {
    capabilities: [],
    country: "Montenegro",
    id: "test-city",
    isActive: true,
    isMain: false,
    latitude: 42,
    longitude: 19,
    name: "Test city",
    slug: "test-city",
    timezone: "Europe/Podgorica",
    ...overrides,
  };
}

test("root and the active city route share the main city canonical identity", () => {
  const rootContext = getMainCityLandingContext();
  const cityContext = resolveActiveCityRoute("podgorica");

  assert.equal(rootContext.city.id, "podgorica");
  assert.equal(cityContext?.city.id, "podgorica");
  assert.equal(
    getCityLandingTitle(rootContext),
    "Podgorica — događaji, izlasci i informacije | Gradom",
  );

  const metadata = getCityLandingMetadata(rootContext);
  assert.equal(metadata.alternates?.canonical, "/podgorica");
  assert.equal(metadata.openGraph?.url, "/podgorica");
  assert.equal(metadata.openGraph?.title, openGraphTitle);
  assert.equal(metadata.openGraph?.description, openGraphDescription);
  assert.notEqual(metadata.title, openGraphTitle);
});

test("does not resolve inactive or unknown city routes", () => {
  assert.equal(resolveActiveCityRoute("budva"), undefined);
  assert.equal(resolveActiveCityRoute("unknown"), undefined);
});

test("feature routes require an explicit city capability", () => {
  const podgorica = createCityContext("podgorica");
  const unsupported = {
    ...podgorica,
    city: { ...podgorica.city, capabilities: [], id: "test-city", slug: "test-city" },
  };

  assert.equal(resolveCityContextCapability(unsupported, "flights"), undefined);
  assert.equal(resolveCityContextCapability(unsupported, "goingOut"), undefined);
  assert.equal(resolveCityContextCapability(unsupported, "electricity"), undefined);
  assert.equal(resolveActiveCityFeatureRoute("podgorica", "flights")?.city.id, "podgorica");
});

test("a city without capabilities does not enable Podgorica dashboard data sources", () => {
  const podgorica = createCityContext("podgorica");
  const unsupported = {
    ...podgorica,
    city: { ...podgorica.city, capabilities: [], id: "test-city", slug: "test-city" },
  };

  assert.deepEqual(getCityDashboardCapabilities(unsupported), {
    cityAlerts: false,
    events: false,
    flights: false,
    goingOut: false,
    railway: false,
  });
});

test("sitemap paths contain only active canonical city paths", () => {
  assert.deepEqual(getCanonicalCitySitemapPaths(), ["/podgorica"]);
});

test("sitemap emits only capability-supported routes for active cities", () => {
  const limited = city({ capabilities: ["events"], id: "limited", slug: "limited" });
  const inactive = city({
    capabilities: ["events", "flights"],
    id: "inactive",
    isActive: false,
    slug: "inactive",
  });

  assert.deepEqual(getActiveCitySitemapPaths([limited, inactive]), [
    "/limited",
    "/limited/filmovi",
    "/limited/dogadjaji",
  ]);
  assert.equal(getActiveCitySitemapPaths([limited, inactive]).includes("/"), false);
  assert.equal(
    getActiveCitySitemapPaths([limited, inactive]).some((path) => path.includes("inactive")),
    false,
  );
});
