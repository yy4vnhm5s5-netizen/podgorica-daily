import assert from "node:assert/strict";
import test from "node:test";

import type {
  SeaWaterQualityHistoryLocation,
  SeaWaterQualityHistoryMeasurement,
} from "../domain/sea-water-quality.ts";
import {
  getDistinctBeachName,
  getRelatedSeaWaterQualityLocations,
  getSeaWaterQualityLocationSummary,
} from "./sea-water-quality-location-ui-model.ts";

test("shows the broader beach for a numbered monitoring point", () => {
  // The page is the canonical URL for point "Jaz 01"; "JAZ" is the beach it sits on, which is
  // genuinely new context and must be shown.
  assert.equal(getDistinctBeachName({ beachName: "JAZ", displayName: "Jaz 01" }), "JAZ");
  assert.equal(
    getDistinctBeachName({ beachName: "SLOVENSKA PLAZA", displayName: "Slovenska plaža 01" }),
    "SLOVENSKA PLAZA",
  );
  assert.equal(getDistinctBeachName({ beachName: "Bečići", displayName: "Bečići 02" }), "Bečići");
});

test("never strips a numeric point suffix to call two values duplicates", () => {
  // Suffix-stripping would make every numbered point look identical to its beach and would
  // suppress the whole line. Each of these must still resolve to a displayed beach name.
  for (const suffix of ["01", "02", "10", "1"]) {
    assert.equal(
      getDistinctBeachName({ beachName: "MOGREN", displayName: `Mogren ${suffix}` }),
      "MOGREN",
    );
  }
});

test("suppresses only an effectively identical complete name", () => {
  // Case, diacritics and insignificant whitespace alone are not new information.
  assert.equal(getDistinctBeachName({ beachName: "KAMENOVO", displayName: "Kamenovo" }), undefined);
  assert.equal(
    getDistinctBeachName({ beachName: "  kamenovo  ", displayName: "Kamenovo" }),
    undefined,
  );
  assert.equal(
    getDistinctBeachName({ beachName: "SLOVENSKA  PLAŽA", displayName: "Slovenska plaza" }),
    undefined,
  );
});

test("returns the verified source string rather than an invented presentation form", () => {
  // No re-casing: the uppercase value is what JPMD published, and nothing in the repository can
  // safely restore "Slovenska plaža" from "SLOVENSKA PLAZA".
  assert.equal(
    getDistinctBeachName({ beachName: "SLOVENSKA PLAZA", displayName: "Slovenska plaža 01" }),
    "SLOVENSKA PLAZA",
  );
});

test("renders nothing when JPMD supplied no beach name", () => {
  assert.equal(getDistinctBeachName({ displayName: "Topolica 01" }), undefined);
  assert.equal(
    getDistinctBeachName({ beachName: undefined, displayName: "Topolica 01" }),
    undefined,
  );
  assert.equal(getDistinctBeachName({ beachName: "   ", displayName: "Topolica 01" }), undefined);
});

const measurement = (
  grade: SeaWaterQualityHistoryMeasurement["grade"],
  sourceRound: number,
  samplingDate?: string,
): SeaWaterQualityHistoryMeasurement => ({
  grade,
  sourceRound,
  ...(samplingDate ? { samplingDate } : {}),
});

test("returns nothing when the point has no retained measurement", () => {
  assert.equal(getSeaWaterQualityLocationSummary({ measurements: [] }), undefined);
});

test("describes a single measurement without claiming any comparison", () => {
  const summary = getSeaWaterQualityLocationSummary({
    measurements: [measurement("good", 3, "2026-07-20")],
  });

  assert.equal(summary?.measurementCount, 1);
  assert.equal(summary?.latest.grade, "good");
  assert.equal(summary?.uniformGrade, true);
  assert.deepEqual(summary?.breakdown, [{ count: 1, grade: "good" }]);
  // No second observation exists, so no trend may be asserted.
  assert.equal(summary?.comparison, undefined);
});

test("reports an unchanged trend for two identical classifications", () => {
  const summary = getSeaWaterQualityLocationSummary({
    measurements: [measurement("good", 1), measurement("good", 2)],
  });

  assert.equal(summary?.comparison?.trend, "unchanged");
  assert.equal(summary?.uniformGrade, true);
});

test("uses JPMD's own severity scale to call an improvement or a deterioration", () => {
  const improved = getSeaWaterQualityLocationSummary({
    measurements: [measurement("poor", 1), measurement("excellent", 2)],
  });
  const worsened = getSeaWaterQualityLocationSummary({
    measurements: [measurement("excellent", 1), measurement("poor", 2)],
  });

  assert.equal(improved?.comparison?.trend, "improved");
  assert.equal(improved?.comparison?.previous.grade, "poor");
  assert.equal(worsened?.comparison?.trend, "worsened");
  assert.equal(worsened?.comparison?.previous.grade, "excellent");
  // Adjacent steps on the scale count too, not only the extremes.
  assert.equal(
    getSeaWaterQualityLocationSummary({
      measurements: [measurement("good", 1), measurement("satisfactory", 2)],
    })?.comparison?.trend,
    "worsened",
  );
});

test("counts a mixed history and orders the breakdown best-to-worst", () => {
  const summary = getSeaWaterQualityLocationSummary({
    measurements: [
      measurement("excellent", 1),
      measurement("satisfactory", 2),
      measurement("good", 3),
      measurement("excellent", 4),
      measurement("excellent", 5),
    ],
  });

  assert.equal(summary?.measurementCount, 5);
  assert.equal(summary?.uniformGrade, false);
  assert.deepEqual(summary?.breakdown, [
    { count: 3, grade: "excellent" },
    { count: 1, grade: "good" },
    { count: 1, grade: "satisfactory" },
  ]);
  assert.equal(summary?.latest.grade, "excellent");
  assert.equal(summary?.comparison?.trend, "unchanged");
});

test("sorts by source round rather than trusting the given order", () => {
  // A reversed input must not flip "improved" into "worsened".
  const summary = getSeaWaterQualityLocationSummary({
    measurements: [measurement("excellent", 3), measurement("poor", 1), measurement("good", 2)],
  });

  assert.equal(summary?.latest.sourceRound, 3);
  assert.equal(summary?.comparison?.previous.sourceRound, 2);
  assert.equal(summary?.comparison?.trend, "improved");
});

test("tolerates measurements with no sampling date", () => {
  const summary = getSeaWaterQualityLocationSummary({
    measurements: [measurement("good", 1), measurement("excellent", 2)],
  });

  assert.equal(summary?.latest.samplingDate, undefined);
  assert.equal(summary?.comparison?.trend, "improved");
  assert.equal(summary?.measurementCount, 2);
});

test("derives every counted value from the supplied measurements alone", () => {
  const summary = getSeaWaterQualityLocationSummary({
    measurements: [measurement("excellent", 1), measurement("good", 2)],
  });
  const counted = summary?.breakdown.reduce((total, { count }) => total + count, 0);

  assert.equal(counted, summary?.measurementCount);
  assert.equal(counted, 2);
});

const historyLocation = (
  displayName: string,
  canonicalSlug: string,
  beachName?: string,
): SeaWaterQualityHistoryLocation => ({
  canonicalSlug,
  displayName,
  firstSeenRound: 1,
  lastSeenRound: 5,
  measurements: [],
  presentInLatestRound: true,
  sourceLocationId: canonicalSlug.length,
  ...(beachName ? { beachName } : {}),
});

const slovenska = [
  historyLocation("Slovenska plaža 01", "slovenska-plaza-01", "SLOVENSKA PLAZA"),
  historyLocation("Slovenska plaža 02", "slovenska-plaza-02", "SLOVENSKA PLAZA"),
  historyLocation("Slovenska plaža 03", "slovenska-plaza-03", "SLOVENSKA PLAZA"),
];

test("groups monitoring points that share a beach name and drops the current one", () => {
  const related = getRelatedSeaWaterQualityLocations({ locations: slovenska }, slovenska[0]);

  assert.deepEqual(
    related.map(({ canonicalSlug }) => canonicalSlug),
    ["slovenska-plaza-02", "slovenska-plaza-03"],
  );
  assert.deepEqual(
    related.map(({ displayName }) => displayName),
    ["Slovenska plaža 02", "Slovenska plaža 03"],
  );
});

test("never groups points from a different beach", () => {
  const locations = [...slovenska, historyLocation("Jaz 01", "jaz-01", "JAZ")];
  const related = getRelatedSeaWaterQualityLocations({ locations }, slovenska[0]);

  assert.equal(
    related.some(({ canonicalSlug }) => canonicalSlug === "jaz-01"),
    false,
  );
  assert.equal(related.length, 2);
});

test("returns nothing when the beach name is absent or blank", () => {
  const locations = [
    historyLocation("Kamenovo", "kamenovo"),
    historyLocation("Ploče", "ploce", "   "),
    historyLocation("Rafailovići", "rafailovici", "PLOČE"),
  ];

  assert.deepEqual(getRelatedSeaWaterQualityLocations({ locations }, locations[0]), []);
  assert.deepEqual(getRelatedSeaWaterQualityLocations({ locations }, locations[1]), []);
});

test("returns nothing for the only point on its beach", () => {
  const locations = [historyLocation("Mogren 01", "mogren-01", "MOGREN")];

  assert.deepEqual(getRelatedSeaWaterQualityLocations({ locations }, locations[0]), []);
});

test("matches on case, diacritics and whitespace only — never on similar-looking names", () => {
  const locations = [
    historyLocation("Sv. Stefan plaža 01", "sv-stefan-plaza-01", "SVETOSTEFANSKA PLAZA"),
    historyLocation("Sv. Stefan plaža 02", "sv-stefan-plaza-02", " svetostefanska  plaža "),
    // A different beach whose name merely starts the same way.
    historyLocation("Svetostefanski most 01", "svetostefanski-most-01", "SVETOSTEFANSKI MOST"),
  ];
  const related = getRelatedSeaWaterQualityLocations({ locations }, locations[0]);

  // The slug prefixes differ entirely from the beach name, which is why beachName is the key.
  assert.deepEqual(
    related.map(({ canonicalSlug }) => canonicalSlug),
    ["sv-stefan-plaza-02"],
  );
});

test("preserves the history's own ordering rather than re-sorting", () => {
  const shuffled = [slovenska[2], slovenska[0], slovenska[1]];
  const related = getRelatedSeaWaterQualityLocations({ locations: shuffled }, slovenska[0]);

  assert.deepEqual(
    related.map(({ canonicalSlug }) => canonicalSlug),
    ["slovenska-plaza-03", "slovenska-plaza-02"],
  );
});

test("returns only the two fields presentation needs and does not mutate the history", () => {
  const locations = structuredClone(slovenska);
  const snapshot = structuredClone(locations);
  const related = getRelatedSeaWaterQualityLocations({ locations }, locations[0]);

  assert.deepEqual(Object.keys(related[0]).sort(), ["canonicalSlug", "displayName"]);
  assert.deepEqual(locations, snapshot);
});
