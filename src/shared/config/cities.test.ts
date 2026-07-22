import assert from "node:assert/strict";
import test from "node:test";

import {
  createCityContext,
  getActiveCities,
  getActiveCityBySlug,
  getCity,
  getCityBySlug,
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

test("exposes Podgorica as the one active main city", () => {
  const mainCity = getMainCity();

  assert.equal(mainCity.id, "podgorica");
  assert.equal(mainCity.slug, "podgorica");
  assert.equal(mainCity.name, "Podgorica");
  assert.equal(mainCity.isActive, true);
  assert.equal(mainCity.isMain, true);
  assert.deepEqual(
    getActiveCities().map(({ slug }) => slug),
    ["podgorica"],
  );
});

test("resolves active route slugs without publishing inactive city configuration", () => {
  assert.equal(getActiveCityBySlug("podgorica")?.id, "podgorica");
  assert.equal(getActiveCityBySlug("budva"), undefined);
  assert.equal(getActiveCityBySlug("unknown"), undefined);
  assert.equal(getCityBySlug("budva")?.isActive, false);
  assert.equal(createCityContext("podgorica").city.timezone, "Europe/Podgorica");
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
