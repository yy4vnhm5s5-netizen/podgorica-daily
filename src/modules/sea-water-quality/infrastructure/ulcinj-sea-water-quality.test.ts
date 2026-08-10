import assert from "node:assert/strict";
import test from "node:test";

import {
  getSeaWaterQualityCityId,
  getSeaWaterQualityMunicipality,
  isSeaWaterQualitySupportedCityId,
} from "./sea-water-quality-cities.ts";
import { getRelatedSeaWaterQualityLocations } from "../presentation/sea-water-quality-location-ui-model.ts";
import type { SeaWaterQualityHistoryLocation } from "../domain/sea-water-quality.ts";

// Verified read-only against the live monitoring source: the <option> for Ulcinj is value="6".
// An earlier comment in this module claimed 18, which returns zero measurements.
test("maps Ulcinj to municipality 6, not the previously assumed 18", () => {
  const municipality = getSeaWaterQualityMunicipality("ulcinj");

  assert.deepEqual(municipality, {
    cityId: "ulcinj",
    municipalityId: 6,
    sourceMunicipalityName: "Ulcinj",
  });
  assert.equal(isSeaWaterQualitySupportedCityId("ulcinj"), true);
  assert.equal(getSeaWaterQualityCityId("ulcinj"), "ulcinj");
  // The other municipalities are untouched.
  assert.equal(getSeaWaterQualityMunicipality("bar")?.municipalityId, 1);
  assert.equal(getSeaWaterQualityMunicipality("kotor")?.municipalityId, 4);
  assert.equal(isSeaWaterQualitySupportedCityId("podgorica"), false);
});

// The 18 real Ulcinj sampling points observed in every 2026 round. Velika Plaža is the largest
// single-beach group on the platform, which is the regression this fixture exists for.
const ulcinjLocations: SeaWaterQualityHistoryLocation[] = [
  { beachName: "ADA BOJANA", name: "Ada Bojana", slug: "ada-bojana" },
  { beachName: "BOROVA SUMA", name: "Borova šuma 01", slug: "borova-suma-01" },
  { beachName: "MALA PLAZA", name: "Mala plaža", slug: "mala-plaza" },
  { beachName: "VALDANOS", name: "Valdanos", slug: "valdanos" },
  ...Array.from({ length: 14 }, (_, index) => {
    const number = String(index + 1).padStart(2, "0");
    return {
      beachName: "VELIKA PLAZA",
      name: `Velika Plaža ${number}`,
      slug: `velika-plaza-${number}`,
    };
  }),
].map(({ beachName, name, slug }, index) => ({
  beachName,
  canonicalSlug: slug,
  displayName: name,
  firstSeenRound: 1,
  lastSeenRound: 5,
  measurements: [],
  presentInLatestRound: true,
  sourceLocationId: index + 1,
}));

test("covers 18 monitoring points with collision-free canonical slugs", () => {
  const slugs = ulcinjLocations.map(({ canonicalSlug }) => canonicalSlug);

  assert.equal(ulcinjLocations.length, 18);
  assert.equal(new Set(slugs).size, 18);
  assert.ok(slugs.includes("velika-plaza-01"));
  assert.ok(slugs.includes("ada-bojana"));
  assert.ok(slugs.includes("borova-suma-01"));
});

test("gives each Velika Plaža point its other 13 siblings and nothing else", () => {
  const current = ulcinjLocations.find(({ canonicalSlug }) => canonicalSlug === "velika-plaza-01");
  assert.ok(current);
  const related = getRelatedSeaWaterQualityLocations({ locations: ulcinjLocations }, current);

  assert.equal(related.length, 13);
  // The current point is excluded and no other beach leaks in.
  assert.equal(
    related.some(({ canonicalSlug }) => canonicalSlug === "velika-plaza-01"),
    false,
  );
  for (const foreign of ["ada-bojana", "borova-suma-01", "mala-plaza", "valdanos"]) {
    assert.equal(
      related.some(({ canonicalSlug }) => canonicalSlug === foreign),
      false,
      foreign,
    );
  }
});

test("leaves single-point Ulcinj beaches without siblings", () => {
  for (const slug of ["ada-bojana", "mala-plaza", "valdanos", "borova-suma-01"]) {
    const current = ulcinjLocations.find((location) => location.canonicalSlug === slug);
    assert.ok(current, slug);
    assert.deepEqual(
      getRelatedSeaWaterQualityLocations({ locations: ulcinjLocations }, current),
      [],
      slug,
    );
  }
});
