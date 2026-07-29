import assert from "node:assert/strict";
import { dirname } from "node:path";
import test from "node:test";

import {
  calculateBudvaSeaWaterQualityFreshness,
  defaultBudvaSeaWaterQualityCachePath,
  getCachedBudvaSeaWaterQuality,
  getSeaWaterQualityCachePath,
  readBudvaSeaWaterQualityCache,
} from "./budva-sea-water-quality-cache.ts";
import type { CacheFileSystem } from "../../../shared/lib/cache.ts";

const snapshot = () => ({
  fetchedAt: "2026-07-24T10:00:00.000Z",
  lastSuccessfulRefreshAt: "2026-07-24T10:00:00.000Z",
  parserWarnings: [],
  schemaVersion: 1 as const,
  source: "Javno preduzeće za upravljanje morskim dobrom Crne Gore" as const,
  sourceUrl: "https://monitoring.morskodobro.me",
  summary: {
    gradeCounts: { excellent: 27, good: 2, poor: 2, satisfactory: 3 },
    latestSamplingDate: "2026-07-23",
    locations: [{ grade: "excellent" as const, id: 36, name: "Jaz 01" }],
    municipality: "budva" as const,
    totalLocations: 34,
  },
});

const fileSystem = (overrides: Partial<CacheFileSystem> = {}): CacheFileSystem => ({
  mkdir: async () => undefined,
  readFile: async () => JSON.stringify(snapshot()),
  rename: async () => undefined,
  rm: async () => undefined,
  writeFile: async () => undefined,
  ...overrides,
});

test("calculates fresh, stale, and unavailable cache states", () => {
  const now = new Date("2026-07-25T10:00:00Z");
  assert.equal(
    calculateBudvaSeaWaterQualityFreshness(new Date("2026-07-25T09:00:00Z"), now, 2_880),
    "fresh",
  );
  assert.equal(
    calculateBudvaSeaWaterQualityFreshness(new Date("2026-07-20T09:00:00Z"), now, 2_880),
    "stale",
  );
  assert.equal(calculateBudvaSeaWaterQualityFreshness(undefined, now), "unavailable");
});

test("reads a valid cache snapshot from disk", async () => {
  const result = await readBudvaSeaWaterQualityCache("/tmp/does-not-matter.json", fileSystem());
  assert.deepEqual(result, snapshot());
});

test("treats a missing file as no cache rather than an error", async () => {
  const result = await readBudvaSeaWaterQualityCache(
    "/tmp/missing.json",
    fileSystem({
      readFile: async () => {
        throw Object.assign(new Error("not found"), { code: "ENOENT" });
      },
    }),
  );
  assert.equal(result, null);
});

test("treats a structurally invalid cache file as unavailable rather than throwing", async () => {
  const result = await readBudvaSeaWaterQualityCache(
    "/tmp/invalid.json",
    fileSystem({ readFile: async () => JSON.stringify({ unexpected: true }) }),
  );
  assert.equal(result, null);
});

test("getCachedBudvaSeaWaterQuality reports unavailable when no snapshot exists", async () => {
  const result = await getCachedBudvaSeaWaterQuality(
    "/tmp/missing.json",
    new Date("2026-07-25T10:00:00Z"),
  );
  assert.deepEqual(result, { state: "unavailable" });
});

test("derives a distinct sibling cache path per supported city without a new env var", () => {
  assert.equal(getSeaWaterQualityCachePath("budva"), defaultBudvaSeaWaterQualityCachePath);
  assert.equal(
    getSeaWaterQualityCachePath("tivat"),
    `${dirname(defaultBudvaSeaWaterQualityCachePath)}/tivat-sea-water-quality.json`,
  );
  assert.notEqual(getSeaWaterQualityCachePath("tivat"), getSeaWaterQualityCachePath("budva"));
});
