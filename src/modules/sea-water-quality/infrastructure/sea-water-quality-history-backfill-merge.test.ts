import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { parseBudvaSeaWaterQualitySummary } from "./budva-sea-water-quality.ts";
import {
  mergeSeaWaterQualityHistory,
  mergeSeaWaterQualityHistoryBackfill,
} from "./sea-water-quality-history-cache.ts";
import type {
  SeaWaterQualityHistory,
  SeaWaterQualityLocation,
} from "../domain/sea-water-quality.ts";
import type { SeaWaterQualitySupportedCityId } from "./sea-water-quality-cities.ts";

const year = 2026;

async function readRoundBody(round: 4 | 5) {
  return readFile(
    new URL(`./__fixtures__/jpmd-2026-round-${round}-full.json`, import.meta.url),
    "utf8",
  );
}

async function readRoundLocations(round: 4 | 5, cityId: SeaWaterQualitySupportedCityId) {
  const parsed = parseBudvaSeaWaterQualitySummary(await readRoundBody(round), cityId);
  assert.ok(parsed, `expected the official round ${round} fixture to parse for ${cityId}`);
  return parsed.summary.locations;
}

function backfill(
  cityId: SeaWaterQualitySupportedCityId,
  round: number,
  summaryLocations: readonly SeaWaterQualityLocation[],
  previous?: SeaWaterQualityHistory,
) {
  return mergeSeaWaterQualityHistoryBackfill({
    cityId,
    ...(previous ? { previous } : {}),
    round,
    summaryLocations,
    year,
  });
}

function current(
  cityId: SeaWaterQualitySupportedCityId,
  round: number,
  summaryLocations: readonly SeaWaterQualityLocation[],
  previous?: SeaWaterQualityHistory,
) {
  return mergeSeaWaterQualityHistory({
    cityId,
    ...(previous ? { previous } : {}),
    round,
    summaryLocations,
    year,
  });
}

function findLocation(history: SeaWaterQualityHistory, sourceLocationId: number) {
  const location = history.locations.find(
    (candidate) => candidate.sourceLocationId === sourceLocationId,
  );
  if (!location) throw new Error(`expected location ${sourceLocationId} in history`);
  return location;
}

test("ingests round 4 into empty history without claiming latest-round presence", async () => {
  const history = backfill("budva", 4, await readRoundLocations(4, "budva"));

  assert.equal(history.year, year);
  assert.equal(history.municipality, "budva");
  assert.equal(history.latestRound, 4);
  assert.ok(history.locations.length > 0);
  for (const location of history.locations) {
    assert.equal(location.measurements.length, 1);
    assert.equal(location.measurements[0].sourceRound, 4);
    assert.equal(location.firstSeenRound, 4);
    // Only a current-round refresh may assert latest-round presence.
    assert.equal(location.presentInLatestRound, false);
  }
});

test("adds round 5 on top of a round 4 backfill without duplicating either", async () => {
  const afterFour = backfill("budva", 4, await readRoundLocations(4, "budva"));
  const afterFive = backfill("budva", 5, await readRoundLocations(5, "budva"), afterFour);

  assert.equal(afterFive.latestRound, 5);
  for (const location of afterFive.locations) {
    assert.deepEqual(
      location.measurements.map((measurement) => measurement.sourceRound),
      [4, 5],
    );
    assert.equal(location.firstSeenRound, 4);
  }
});

test("backfilling round 4 after current round 5 never downgrades latest metadata", async () => {
  const [four, five] = await Promise.all([
    readRoundLocations(4, "budva"),
    readRoundLocations(5, "budva"),
  ]);
  const afterCurrentFive = current("budva", 5, five);
  const afterBackfillFour = backfill("budva", 4, four, afterCurrentFive);

  assert.equal(afterCurrentFive.latestRound, 5);
  assert.equal(afterBackfillFour.latestRound, 5, "latestRound must not be downgraded to 4");
  for (const location of afterBackfillFour.locations) {
    assert.equal(location.lastSeenRound, 5, "lastSeenRound must not be downgraded");
    assert.equal(location.presentInLatestRound, true, "presence in round 5 must survive");
    assert.equal(location.firstSeenRound, 4, "firstSeenRound must move backwards to 4");
    assert.deepEqual(
      location.measurements.map((measurement) => measurement.sourceRound),
      [4, 5],
    );
  }
});

test("is idempotent: rerunning either round adds no duplicate measurement", async () => {
  const [four, five] = await Promise.all([
    readRoundLocations(4, "budva"),
    readRoundLocations(5, "budva"),
  ]);
  const once = backfill("budva", 5, five, backfill("budva", 4, four));
  const twice = backfill("budva", 4, four, backfill("budva", 5, five, once));

  assert.deepEqual(twice, once, "a rerun of both rounds must be a no-op");
  for (const location of twice.locations) {
    assert.equal(location.measurements.length, 2);
  }
});

test("replaces a corrected measurement for the same round instead of appending it", async () => {
  const four = await readRoundLocations(4, "budva");
  const baseline = backfill("budva", 4, four);
  const target = four[0];
  const correctedGrade = target.grade === "excellent" ? "poor" : "excellent";
  const corrected = backfill(
    "budva",
    4,
    [{ ...target, grade: correctedGrade }, ...four.slice(1)],
    baseline,
  );

  const location = findLocation(corrected, target.id);
  assert.equal(location.measurements.length, 1);
  assert.equal(location.measurements[0].sourceRound, 4);
  assert.equal(location.measurements[0].grade, correctedGrade);
});

test("keeps measurements chronologically ordered regardless of ingestion order", async () => {
  const [four, five] = await Promise.all([
    readRoundLocations(4, "budva"),
    readRoundLocations(5, "budva"),
  ]);
  const newestFirst = backfill("budva", 4, four, backfill("budva", 5, five));
  const oldestFirst = backfill("budva", 5, five, backfill("budva", 4, four));

  for (const location of newestFirst.locations) {
    assert.deepEqual(
      location.measurements.map((measurement) => measurement.sourceRound),
      [4, 5],
    );
  }
  assert.deepEqual(
    newestFirst.locations.map((location) => location.sourceLocationId),
    oldestFirst.locations.map((location) => location.sourceLocationId),
    "location order must be deterministic regardless of ingestion order",
  );
});

test("never marks a location absent because it is missing from an older round", async () => {
  const [four, five] = await Promise.all([
    readRoundLocations(4, "budva"),
    readRoundLocations(5, "budva"),
  ]);
  const afterCurrentFive = current("budva", 5, five);
  // This location exists in round 5 but is withheld from the older round being backfilled.
  const missingId = four[0].id;
  const partialFour = four.slice(1);
  const afterBackfill = backfill("budva", 4, partialFour, afterCurrentFive);

  const untouched = findLocation(afterBackfill, missingId);
  assert.equal(untouched.presentInLatestRound, true);
  assert.equal(untouched.lastSeenRound, 5);
  assert.deepEqual(
    untouched.measurements.map((measurement) => measurement.sourceRound),
    [5],
    "a location absent from the older round keeps only the rounds it actually has",
  );
  assert.equal(afterBackfill.locations.length, afterCurrentFive.locations.length);
});

test("isolates municipalities: one national round yields only that city's records", async () => {
  const body = await readRoundBody(4);
  const budva = parseBudvaSeaWaterQualitySummary(body, "budva");
  const bar = parseBudvaSeaWaterQualitySummary(body, "bar");
  assert.ok(budva);
  assert.ok(bar);

  const budvaHistory = backfill("budva", 4, budva.summary.locations);
  const barHistory = backfill("bar", 4, bar.summary.locations);

  assert.equal(budvaHistory.municipality, "budva");
  assert.equal(budvaHistory.sourceMunicipalityId, 2);
  assert.equal(barHistory.municipality, "bar");
  assert.equal(barHistory.sourceMunicipalityId, 1);

  const budvaIds = new Set(budvaHistory.locations.map((location) => location.sourceLocationId));
  const sharedIds = barHistory.locations.filter((location) =>
    budvaIds.has(location.sourceLocationId),
  );
  assert.equal(sharedIds.length, 0, "Bar and Budva must not share monitoring-location ids");
});

test("keeps per-city histories independent when the same source id appears in both", async () => {
  const four = await readRoundLocations(4, "budva");
  const collidingId = four[0].id;
  // Force the collision the real data does not have, to prove identity is scoped per city file.
  const barHistory = backfill("bar", 4, [{ ...four[0], grade: "poor", name: "Bar test" }]);
  const budvaHistory = backfill("budva", 4, four);

  assert.equal(findLocation(barHistory, collidingId).displayName, "Bar test");
  assert.equal(findLocation(budvaHistory, collidingId).displayName, four[0].name);
});

test("ignores history from a different season", async () => {
  const four = await readRoundLocations(4, "budva");
  const otherSeason = { ...backfill("budva", 4, four), year: 2025 };
  const merged = mergeSeaWaterQualityHistoryBackfill({
    cityId: "budva",
    previous: otherSeason,
    round: 4,
    summaryLocations: four,
    year,
  });

  assert.equal(merged.year, year);
  for (const location of merged.locations) {
    assert.equal(location.measurements.length, 1);
  }
});
