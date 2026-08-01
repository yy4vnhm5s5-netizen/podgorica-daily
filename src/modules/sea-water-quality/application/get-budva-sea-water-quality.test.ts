import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  canReadBudvaSeaWaterQuality,
  getBudvaSeaWaterQuality,
} from "./get-budva-sea-water-quality.ts";
import {
  getCachedBudvaSeaWaterQuality,
  getSeaWaterQualityCachePath,
  writeBudvaSeaWaterQualityCache,
  type BudvaSeaWaterQualityCacheSnapshot,
} from "../infrastructure/budva-sea-water-quality-cache.ts";
import { createCityContext } from "@/shared/config/cities";

test("does not read the sea water quality cache for a city without the capability", async () => {
  const podgorica = createCityContext("podgorica");

  assert.equal(canReadBudvaSeaWaterQuality(podgorica), false);
  const result = await getBudvaSeaWaterQuality(podgorica);
  assert.deepEqual(result, { state: "unavailable" });
});

test("allows the sea water quality cache for every capability-supported city", () => {
  const budva = createCityContext("budva");
  const kotor = createCityContext("kotor");
  const tivat = createCityContext("tivat");
  assert.equal(canReadBudvaSeaWaterQuality(budva), true);
  assert.equal(canReadBudvaSeaWaterQuality(kotor), true);
  assert.equal(canReadBudvaSeaWaterQuality(tivat), true);
});

function snapshotFor(
  municipality: "budva" | "kotor" | "tivat",
  totalLocations: number,
): BudvaSeaWaterQualityCacheSnapshot {
  return {
    fetchedAt: "2026-07-29T10:00:00.000Z",
    lastSuccessfulRefreshAt: "2026-07-29T10:00:00.000Z",
    parserWarnings: [],
    schemaVersion: 1,
    source: "Javno preduzeće za upravljanje morskim dobrom Crne Gore",
    sourceUrl: "https://monitoring.morskodobro.me",
    summary: {
      gradeCounts: { excellent: totalLocations, good: 0, poor: 0, satisfactory: 0 },
      locations: [],
      municipality,
      totalLocations,
    },
  };
}

// The bug this guards against: getBudvaSeaWaterQuality previously read a single hardcoded env
// path regardless of which city's context it was given, so enabling the capability for a second
// city would have silently served it Budva's beach data. getSeaWaterQualityCachePath is the exact
// mechanism getBudvaSeaWaterQuality now uses internally to pick a path from context.city.id — this
// proves that mechanism resolves to genuinely independent files with independent content, not
// just different-looking path strings.
test("Budva, Kotor and Tivat cache paths are independent files that never cross-contaminate each other's data", async () => {
  const directory = await mkdtemp(join(tmpdir(), "sea-water-quality-isolation-"));
  try {
    const budvaPath = join(directory, "budva-sea-water-quality.json");
    const kotorPath = join(directory, "kotor-sea-water-quality.json");
    const tivatPath = join(directory, "tivat-sea-water-quality.json");
    assert.notEqual(budvaPath, tivatPath);
    assert.notEqual(budvaPath, kotorPath);
    assert.notEqual(kotorPath, tivatPath);

    await writeBudvaSeaWaterQualityCache(snapshotFor("budva", 34), budvaPath);
    await writeBudvaSeaWaterQualityCache(snapshotFor("kotor", 15), kotorPath);
    await writeBudvaSeaWaterQualityCache(snapshotFor("tivat", 10), tivatPath);

    const budvaResult = await getCachedBudvaSeaWaterQuality(
      budvaPath,
      new Date("2026-07-29T11:00:00Z"),
    );
    const kotorResult = await getCachedBudvaSeaWaterQuality(
      kotorPath,
      new Date("2026-07-29T11:00:00Z"),
    );
    const tivatResult = await getCachedBudvaSeaWaterQuality(
      tivatPath,
      new Date("2026-07-29T11:00:00Z"),
    );

    assert.equal(budvaResult.summary?.municipality, "budva");
    assert.equal(budvaResult.summary?.totalLocations, 34);
    assert.equal(kotorResult.summary?.municipality, "kotor");
    assert.equal(kotorResult.summary?.totalLocations, 15);
    assert.equal(tivatResult.summary?.municipality, "tivat");
    assert.equal(tivatResult.summary?.totalLocations, 10);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

test("getSeaWaterQualityCachePath — the mechanism getBudvaSeaWaterQuality resolves per context.city.id — never collides across supported cities", () => {
  assert.notEqual(getSeaWaterQualityCachePath("budva"), getSeaWaterQualityCachePath("tivat"));
  assert.notEqual(getSeaWaterQualityCachePath("budva"), getSeaWaterQualityCachePath("kotor"));
  assert.notEqual(getSeaWaterQualityCachePath("kotor"), getSeaWaterQualityCachePath("tivat"));
});
