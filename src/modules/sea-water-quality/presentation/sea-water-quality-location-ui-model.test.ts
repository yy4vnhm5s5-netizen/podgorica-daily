import assert from "node:assert/strict";
import test from "node:test";

import type { SeaWaterQualityHistoryMeasurement } from "../domain/sea-water-quality.ts";
import {
  getDistinctBeachName,
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
  assert.equal(summary?.comparison?.trend, "improved");
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
