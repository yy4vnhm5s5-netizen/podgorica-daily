import assert from "node:assert/strict";
import test from "node:test";

import { mergeSeaWaterQualityHistory } from "./sea-water-quality-history-cache.ts";

test("creates clean, city-scoped canonical slugs and preserves them after a source rename", () => {
  const first = mergeSeaWaterQualityHistory({
    cityId: "budva",
    round: 4,
    summaryLocations: [
      {
        beachName: "JAZ",
        grade: "excellent",
        id: 36,
        name: "Jaz 01",
        samplingDate: "2026-07-10",
        samplingDateTime: "10.07.2026. 10:00",
      },
    ],
    year: 2026,
  });
  assert.equal(first.locations[0]?.canonicalSlug, "jaz-01");
  assert.equal(first.locations[0]?.measurements.length, 1);

  const second = mergeSeaWaterQualityHistory({
    cityId: "budva",
    previous: first,
    round: 5,
    summaryLocations: [
      {
        beachName: "JAZ",
        grade: "good",
        id: 36,
        name: "Jaz 1",
        samplingDate: "2026-07-24",
        samplingDateTime: "24.07.2026. 10:00",
      },
    ],
    year: 2026,
  });
  assert.equal(second.locations[0]?.canonicalSlug, "jaz-01");
  assert.equal(second.locations[0]?.displayName, "Jaz 1");
  assert.deepEqual(
    second.locations[0]?.measurements.map((measurement) => measurement.sourceRound),
    [4, 5],
  );
});

test("updates the same round idempotently and marks locations absent from the latest round", () => {
  const initial = mergeSeaWaterQualityHistory({
    cityId: "kotor",
    round: 5,
    summaryLocations: [
      { grade: "excellent", id: 65, name: "Risan 01", samplingDate: "2026-07-24" },
      { grade: "good", id: 99, name: "Dobrota 01", samplingDate: "2026-07-24" },
    ],
    year: 2026,
  });
  const retried = mergeSeaWaterQualityHistory({
    cityId: "kotor",
    previous: initial,
    round: 5,
    summaryLocations: [{ grade: "poor", id: 65, name: "Risan 01", samplingDate: "2026-07-24" }],
    year: 2026,
  });

  const risan = retried.locations.find((location) => location.sourceLocationId === 65);
  const dobrota = retried.locations.find((location) => location.sourceLocationId === 99);
  assert.deepEqual(risan?.measurements, [
    { grade: "poor", samplingDate: "2026-07-24", sourceRound: 5 },
  ]);
  assert.equal(risan?.presentInLatestRound, true);
  assert.equal(dobrota?.presentInLatestRound, false);
});

test("starts a bounded new seasonal history when the monitoring year changes", () => {
  const previous = mergeSeaWaterQualityHistory({
    cityId: "tivat",
    round: 8,
    summaryLocations: [{ grade: "excellent", id: 87, name: "Gradska plaža 01" }],
    year: 2026,
  });
  const nextSeason = mergeSeaWaterQualityHistory({
    cityId: "tivat",
    previous,
    round: 1,
    summaryLocations: [{ grade: "good", id: 87, name: "Gradska plaža 01" }],
    year: 2027,
  });

  assert.equal(nextSeason.year, 2027);
  assert.equal(nextSeason.locations.length, 1);
  assert.deepEqual(nextSeason.locations[0]?.measurements, [{ grade: "good", sourceRound: 1 }]);
});
