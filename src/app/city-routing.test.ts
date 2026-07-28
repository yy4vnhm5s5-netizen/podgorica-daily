import assert from "node:assert/strict";
import test from "node:test";

import {
  getCanonicalCitySitemapPaths,
  getActiveCitySitemapPaths,
  getCityDashboardCapabilities,
  getCityDashboardSummaryAvailability,
  getCityLandingMetadata,
  getCityLandingTitle,
  getCitySitemapPaths,
  getMainCityLandingContext,
  isCityPublicFeatureRouteAvailable,
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

test("the active city route uses its own canonical metadata", () => {
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
  assert.equal(metadata.openGraph?.title, getCityLandingTitle(rootContext));
  assert.equal(metadata.openGraph?.description, metadata.description);
});

test("uses capability-aware metadata and summary routes for a future city", () => {
  const budva = {
    ...createCityContext("budva"),
    city: { ...createCityContext("budva").city, isActive: true },
  };

  assert.equal(getCityLandingTitle(budva), "Budva — lokalne informacije | Gradom");
  assert.match(getCityLandingMetadata(budva).description ?? "", /vremenu, izlascima/u);
  assert.deepEqual(getCityDashboardSummaryAvailability(budva.city), {
    cinema: false,
    events: false,
    goingOut: true,
    seaWaterQuality: true,
  });
});

test("resolves active Budva routes but rejects inactive and unknown city routes", () => {
  assert.equal(resolveActiveCityRoute("budva")?.city.id, "budva");
  assert.equal(resolveActiveCityRoute("bar"), undefined);
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
    seaWaterQuality: false,
    weather: false,
  });
});

test("sitemap paths contain only active canonical city paths", () => {
  assert.deepEqual(getCanonicalCitySitemapPaths(), ["/budva", "/podgorica"]);
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

test("does not publish feature-flagged routes when their public feature is disabled", () => {
  const full = city({
    capabilities: ["events", "electricity", "flights", "goingOut"],
    id: "full",
    slug: "full",
  });
  const isFeatureEnabled = () => false;

  assert.equal(isCityPublicFeatureRouteAvailable(full, "flights", { isFeatureEnabled }), false);
  assert.equal(isCityPublicFeatureRouteAvailable(full, "goingOut", { isFeatureEnabled }), false);
  assert.equal(isCityPublicFeatureRouteAvailable(full, "events", { isFeatureEnabled }), true);
  assert.deepEqual(getCitySitemapPaths(full, { isFeatureEnabled }), [
    "/full",
    "/full/filmovi",
    "/full/dogadjaji",
    "/full/struja",
  ]);
});

test("exposes only Budva's capability-supported feature routes", () => {
  const budva = createCityContext("budva").city;

  assert.equal(isCityPublicFeatureRouteAvailable(budva, "goingOut"), true);
  assert.equal(isCityPublicFeatureRouteAvailable(budva, "electricity"), true);
  assert.equal(isCityPublicFeatureRouteAvailable(budva, "events"), false);
  assert.equal(isCityPublicFeatureRouteAvailable(budva, "flights"), false);
  assert.deepEqual(getCitySitemapPaths(budva), ["/budva", "/budva/struja", "/budva/izlasci"]);
});
