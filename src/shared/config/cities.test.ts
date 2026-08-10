import assert from "node:assert/strict";
import test from "node:test";

import {
  cityRegistry,
  createCityContext,
  getActiveCities,
  getActiveCityBySlug,
  getCity,
  getCityBySlug,
  getCityName,
  getMainCity,
  isCityId,
  supportsCityCapability,
  validateCityRegistry,
} from "./cities.ts";
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

test("exposes Podgorica as the main city and every active public city", () => {
  const mainCity = getMainCity();

  assert.equal(mainCity.id, "podgorica");
  assert.equal(mainCity.slug, "podgorica");
  assert.equal(mainCity.name, "Podgorica");
  assert.equal(mainCity.isActive, true);
  assert.equal(mainCity.isMain, true);
  assert.deepEqual(
    getActiveCities().map(({ slug }) => slug),
    ["bar", "budva", "kotor", "podgorica", "tivat", "ulcinj"],
  );
});

test("registers Bar with its approved weather, electricity, Going Out, and sea-water capabilities", () => {
  const bar = getCityBySlug("bar");

  assert.equal(bar?.id, "bar");
  assert.equal(bar?.isActive, true);
  assert.deepEqual(bar?.capabilities, ["electricity", "goingOut", "seaWaterQuality", "weather"]);
  assert.equal(getCityName(bar!, "locative"), "Baru");
  assert.equal(bar?.timezone, "Europe/Podgorica");
  assert.equal(bar?.latitude, 42.0937);
  assert.equal(bar?.longitude, 19.1005);
  for (const capability of ["events", "flights", "railway", "water"] as const) {
    assert.equal(supportsCityCapability(bar!, capability), false);
  }
});

test("registers Tivat as a third active city with its launch-phase capability set", () => {
  const tivat = getCityBySlug("tivat");

  assert.equal(tivat?.id, "tivat");
  assert.equal(tivat?.isActive, true);
  assert.equal(tivat?.isMain, false);
  assert.deepEqual(tivat?.capabilities, [
    "electricity",
    "events",
    "goingOut",
    "seaWaterQuality",
    "weather",
  ]);
  assert.equal(supportsCityCapability(tivat!, "events"), true);
  assert.equal(supportsCityCapability(tivat!, "seaWaterQuality"), true);
  // Still excluded: water by product decision (no approved provider coverage), flights
  // (Airports of Montenegro's airport= code for Tivat is not yet verified — see
  // podgorica-flights.ts).
  for (const capability of ["water", "flights"] as const) {
    assert.equal(supportsCityCapability(tivat!, capability), false);
  }
  assert.equal(getCityName(tivat!, "locative"), "Tivtu");
  assert.equal(getCityName(tivat!, "accusative"), "Tivat");
  assert.equal(tivat?.timezone, "Europe/Podgorica");
  assert.equal(tivat?.latitude, 42.4353);
  assert.equal(tivat?.longitude, 18.6961);
  // Adding a third active city must not disturb the single main city.
  assert.equal(getMainCity().id, "podgorica");
});

test("resolves active city route slugs and keeps Kotor's approved capability set explicit", () => {
  assert.equal(getActiveCityBySlug("podgorica")?.id, "podgorica");
  assert.equal(getActiveCityBySlug("budva")?.id, "budva");
  assert.equal(getActiveCityBySlug("kotor")?.id, "kotor");
  assert.equal(getActiveCityBySlug("bar")?.id, "bar");
  assert.equal(getActiveCityBySlug("unknown"), undefined);
  assert.equal(getCityBySlug("budva")?.isActive, true);
  assert.deepEqual(getCityBySlug("budva")?.capabilities, [
    "electricity",
    "weather",
    "goingOut",
    "seaWaterQuality",
  ]);
  assert.equal(getCityBySlug("budva")?.latitude, 42.2864);
  assert.equal(getCityBySlug("budva")?.longitude, 18.8401);
  assert.equal(getCityBySlug("budva")?.timezone, "Europe/Podgorica");
  assert.equal(createCityContext("podgorica").city.timezone, "Europe/Podgorica");
  assert.equal(getCityName(getCityBySlug("budva")!, "locative"), "Budvi");
  assert.equal(getCityName(getCityBySlug("podgorica")!, "locative"), "Podgorici");
  const kotor = getCityBySlug("kotor");
  assert.equal(kotor?.isActive, true);
  assert.deepEqual(kotor?.capabilities, [
    "electricity",
    "goingOut",
    "seaWaterQuality",
    "water",
    "weather",
  ]);
  assert.equal(getCityName(kotor!, "locative"), "Kotoru");
  assert.equal(getCityName(kotor!, "accusative"), "Kotor");
  assert.equal(kotor?.latitude, 42.4247);
  assert.equal(kotor?.longitude, 18.7712);
  assert.equal(kotor?.timezone, "Europe/Podgorica");
  assert.equal(getActiveCityBySlug("kotor")?.id, "kotor");
});

test("rejects prototype properties as city identifiers", () => {
  for (const value of ["__proto__", "toString", "constructor"]) {
    assert.equal(isCityId(value), false);
    assert.equal(getCity(value), undefined);
  }
});

test("keeps capabilities explicit per city", () => {
  assert.deepEqual(getMainCity().capabilities, [
    "electricity",
    "events",
    "flights",
    "goingOut",
    "railway",
    "water",
    "weather",
  ]);
  assert.equal(supportsCityCapability(getMainCity(), "events"), true);
  assert.equal(supportsCityCapability(city(), "events"), false);
});

test("validates a correct city registry", () => {
  assert.doesNotThrow(() => validateCityRegistry({ "test-city": city({ isMain: true }) }));
});

test("rejects invalid city registry invariants", () => {
  assert.throws(() => validateCityRegistry({ "test-city": city() }), /exactly one main city/);
  assert.throws(
    () =>
      validateCityRegistry({
        first: city({ id: "first", isMain: true, slug: "first" }),
        second: city({ id: "second", isMain: true, slug: "second" }),
      }),
    /exactly one main city/,
  );
  assert.throws(
    () => validateCityRegistry({ "test-city": city({ isActive: false, isMain: true }) }),
    /must be active/,
  );
  assert.throws(
    () =>
      validateCityRegistry([
        ["shared", city({ id: "shared", isMain: true, slug: "first" })],
        ["shared", city({ id: "shared", slug: "second" })],
      ]),
    /duplicate ID/,
  );
  assert.throws(
    () =>
      validateCityRegistry([
        ["first", city({ id: "first", isMain: true, slug: "shared" })],
        ["second", city({ id: "second", slug: "shared" })],
      ]),
    /duplicate slug/,
  );
  assert.throws(
    () => validateCityRegistry({ wrong: city({ isMain: true }) }),
    /must match city ID/,
  );
  assert.throws(
    () => validateCityRegistry({ "test-city": city({ id: "", isMain: true }) }),
    /empty ID/,
  );
  assert.throws(
    () => validateCityRegistry({ "test-city": city({ isMain: true, slug: "" }) }),
    /empty slug/,
  );
});

// Genitive was added because "iz" governs it — "Letovi iz Podgorice", not "iz Podgorica".
test("exposes a verified genitive form for every registered city", () => {
  const expected: Record<string, string> = {
    bar: "Bara",
    budva: "Budve",
    kotor: "Kotora",
    niksic: "Nikšića",
    podgorica: "Podgorice",
    tivat: "Tivta",
    ulcinj: "Ulcinja",
  };

  const registered = Object.values(cityRegistry);
  // Every record must be covered, so a future city cannot silently fall back to the nominative.
  assert.deepEqual(registered.map((city) => city.id).sort(), Object.keys(expected).sort());
  for (const city of registered) {
    assert.equal(getCityName(city, "genitive"), expected[city.id], city.id);
    assert.equal(city.genitiveName, expected[city.id], city.id);
  }
});

test("adding the genitive leaves the other three forms untouched", () => {
  const expected: Record<string, [string, string, string]> = {
    bar: ["Bar", "Bar", "Baru"],
    budva: ["Budva", "Budvu", "Budvi"],
    kotor: ["Kotor", "Kotor", "Kotoru"],
    niksic: ["Nikšić", "Nikšić", "Nikšiću"],
    podgorica: ["Podgorica", "Podgoricu", "Podgorici"],
    tivat: ["Tivat", "Tivat", "Tivtu"],
    ulcinj: ["Ulcinj", "Ulcinj", "Ulcinju"],
  };

  for (const city of Object.values(cityRegistry)) {
    const [nominative, accusative, locative] = expected[city.id];
    assert.equal(getCityName(city), nominative, city.id);
    assert.equal(getCityName(city, "nominative"), nominative, city.id);
    assert.equal(getCityName(city, "accusative"), accusative, city.id);
    assert.equal(getCityName(city, "locative"), locative, city.id);
  }
});

test("falls back to the nominative for a city that declares no genitive", () => {
  const podgorica = getCity("podgorica");
  assert.ok(podgorica);
  const { genitiveName: _genitiveName, ...withoutGenitive } = podgorica;

  assert.equal(getCityName(withoutGenitive, "genitive"), "Podgorica");
});
