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
  isCityCinemaRouteAvailable,
  isCityPublicFeatureRouteAvailable,
  resolveActiveCityFeatureRoute,
  resolveActiveCityRoute,
} from "./city-routing.ts";
import { resolveCityContextCapability } from "@/config/city-context";
import {
  createCityContext,
  getActiveCities,
  getCityName,
  supportsCityCapability,
} from "@/shared/config/cities";
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
    "Podgorica — događaji, izlasci i informacije | Gradom.me",
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

  assert.equal(getCityLandingTitle(budva), "Budva — izlasci, plaže i informacije | Gradom.me");
  assert.match(getCityLandingMetadata(budva).description ?? "", /vremenu, izlascima/u);
  assert.deepEqual(getCityDashboardSummaryAvailability(budva.city), {
    cinema: false,
    events: false,
    goingOut: true,
    seaWaterQuality: true,
  });
});

test("advertises sea-water coverage on the hub of every city that declares the capability", () => {
  for (const cityId of ["bar", "budva", "kotor", "tivat", "ulcinj"]) {
    const context = createCityContext(cityId);
    const description = getCityLandingMetadata(context).description ?? "";

    assert.equal(supportsCityCapability(context.city, "seaWaterQuality"), true);
    assert.match(getCityLandingTitle(context), /plaže/u, `${cityId} title must mention beaches`);
    assert.match(description, /plažama i kvalitetu mora/u, `${cityId} description`);
    // "za grad" governs the accusative — this assertion used to encode the nominative, which is
    // how "za grad Budva" reached production.
    assert.match(
      description,
      new RegExp(`za grad ${getCityName(context.city, "accusative")}`, "u"),
    );
    assert.equal(getCityLandingMetadata(context).alternates?.canonical, `/${context.city.slug}`);
  }
});

test("keeps sea-water wording off a city that does not declare the capability", () => {
  const podgorica = createCityContext("podgorica");

  assert.equal(supportsCityCapability(podgorica.city, "seaWaterQuality"), false);
  assert.equal(
    getCityLandingTitle(podgorica),
    "Podgorica — događaji, izlasci i informacije | Gradom.me",
  );
  assert.doesNotMatch(getCityLandingMetadata(podgorica).description ?? "", /plaž|mora/u);
});

test("derives hub wording from capabilities alone, not from any hardcoded city", () => {
  // A synthetic city the registry has never heard of still gets the coastal wording purely by
  // declaring the capability — proving the rule is capability-driven rather than city-keyed.
  const synthetic = {
    city: city({ capabilities: ["seaWaterQuality"], name: "Testgrad", slug: "testgrad" }),
    locale: "me" as const,
    timezone: "Europe/Podgorica",
  };

  assert.equal(getCityLandingTitle(synthetic), "Testgrad — plaže i informacije | Gradom.me");
  assert.match(
    getCityLandingMetadata(synthetic).description ?? "",
    /sa podacima o plažama i kvalitetu mora\.$/u,
  );

  const withoutCapabilities = {
    city: city({ name: "Praznograd", slug: "praznograd" }),
    locale: "me" as const,
    timezone: "Europe/Podgorica",
  };
  assert.equal(
    getCityLandingTitle(withoutCapabilities),
    "Praznograd — lokalne informacije | Gradom.me",
  );
});

test("cinema route availability requires both the events capability and Cineplexx city support", () => {
  const podgorica = createCityContext("podgorica").city;
  const eventsOnlyCity = city({ capabilities: ["events"], id: "events-only", slug: "events-only" });

  assert.equal(isCityCinemaRouteAvailable(podgorica), true);
  assert.equal(isCityCinemaRouteAvailable(eventsOnlyCity), false);
  assert.deepEqual(getCityDashboardSummaryAvailability(podgorica), {
    cinema: true,
    events: true,
    goingOut: true,
    seaWaterQuality: false,
  });
});

test("resolves active public city routes but rejects inactive and unknown city routes", () => {
  assert.equal(resolveActiveCityRoute("budva")?.city.id, "budva");
  assert.equal(resolveActiveCityRoute("kotor")?.city.id, "kotor");
  assert.equal(resolveActiveCityRoute("bar")?.city.id, "bar");
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
    parking: false,
    railway: false,
    seaWaterQuality: false,
    weather: false,
  });
});

test("derives dashboard Parking availability solely from each city's declared capability", () => {
  for (const city of getActiveCities()) {
    assert.equal(
      getCityDashboardCapabilities(createCityContext(city.id)).parking,
      city.capabilities?.includes("parking") ?? false,
    );
  }
});

test("sitemap paths contain only active canonical city paths", () => {
  assert.deepEqual(getCanonicalCitySitemapPaths(), [
    "/bar",
    "/budva",
    "/kotor",
    "/podgorica",
    "/tivat",
    "/ulcinj",
  ]);
});

test("sitemap emits only capability-supported routes for active cities", () => {
  const limited = city({ capabilities: ["events"], id: "limited", slug: "limited" });
  const inactive = city({
    capabilities: ["events", "flights"],
    id: "inactive",
    isActive: false,
    slug: "inactive",
  });

  assert.equal(isCityCinemaRouteAvailable(limited), false);
  assert.deepEqual(getActiveCitySitemapPaths([limited, inactive]), [
    "/limited",
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
  assert.deepEqual(getCitySitemapPaths(budva), [
    "/budva",
    "/budva/struja",
    "/budva/izlasci",
    "/budva/plaze",
  ]);
});

test("Bar exposes only its approved weather, electricity, Going Out, and sea-water routes", () => {
  const bar = createCityContext("bar").city;

  assert.deepEqual(getCitySitemapPaths(bar), ["/bar", "/bar/struja", "/bar/izlasci", "/bar/plaze"]);
  assert.deepEqual(getCityDashboardSummaryAvailability(bar), {
    cinema: false,
    events: false,
    goingOut: true,
    seaWaterQuality: true,
  });
  assert.deepEqual(getCityDashboardCapabilities(createCityContext("bar")), {
    cityAlerts: true,
    events: false,
    flights: false,
    goingOut: true,
    parking: false,
    railway: false,
    seaWaterQuality: true,
    weather: true,
  });
  for (const capability of ["events", "flights", "railway", "water"] as const) {
    assert.equal(isCityPublicFeatureRouteAvailable(bar, capability), false);
  }
});

test("Kotor exposes only its capability-supported public routes", () => {
  const kotor = createCityContext("kotor").city;

  assert.deepEqual(getCitySitemapPaths(kotor), [
    "/kotor",
    "/kotor/struja",
    "/kotor/izlasci",
    "/kotor/plaze",
  ]);
  assert.equal(getCityLandingMetadata(createCityContext("kotor")).alternates?.canonical, "/kotor");
  assert.equal(getCityLandingMetadata(createCityContext("kotor")).openGraph?.url, "/kotor");
  assert.equal(isCityPublicFeatureRouteAvailable(kotor, "events"), false);
  assert.equal(isCityPublicFeatureRouteAvailable(kotor, "flights"), false);
  assert.equal(isCityPublicFeatureRouteAvailable(kotor, "goingOut"), true);
  assert.equal(isCityPublicFeatureRouteAvailable(kotor, "electricity"), true);
  assert.equal(isCityPublicFeatureRouteAvailable(kotor, "water"), true);
  assert.equal(isCityPublicFeatureRouteAvailable(kotor, "railway"), false);
  assert.equal(isCityPublicFeatureRouteAvailable(kotor, "seaWaterQuality"), true);
});

test("every city hub description agrees in case with the preposition governing it", () => {
  // The registry carries every form; only two of six names differ between nominative and
  // accusative, which is exactly why the wrong one survived unnoticed in production.
  for (const city of getActiveCities()) {
    const context = createCityContext(city.id);
    const description = getCityLandingMetadata(context).description ?? "";

    assert.match(
      description,
      new RegExp(`za grad ${getCityName(city, "accusative")}[,.]`, "u"),
      city.id,
    );
    if (getCityName(city, "accusative") !== city.name) {
      assert.doesNotMatch(description, new RegExp(`za grad ${city.name}[,.]`, "u"), city.id);
    }
  }
});

test("the registry blurb names every service group the city actually has", () => {
  // Kotor gained beaches and Ulcinj gained electricity and water after their blurbs were written,
  // so both under-described the city on its homepage card. This pins the drift, not the wording:
  // a broad group ("plaže", "servisne informacije"), never an exhaustive capability list.
  for (const city of getActiveCities()) {
    const blurb = city.description ?? "";
    assert.notEqual(blurb, "", city.id);

    if (supportsCityCapability(city, "seaWaterQuality")) {
      assert.match(blurb, /plaž/iu, `${city.id} has beaches but does not mention them`);
    }
    if (supportsCityCapability(city, "electricity") || supportsCityCapability(city, "water")) {
      assert.match(blurb, /servisne informacije|struja/iu, `${city.id} has service alerts`);
    }
  }
});
