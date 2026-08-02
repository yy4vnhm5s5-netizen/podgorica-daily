import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  getActiveSeaWaterQualityContexts,
  runActiveSeaWaterQualityCollectors,
  runBudvaSeaWaterQualityCollector,
  type BudvaSeaWaterQualityCollectorResult,
} from "./collect-budva-sea-water-quality.ts";
import { createCityContext } from "@/shared/config/cities";
import type { City } from "@/shared/types/city";

async function withCacheDirectory(run: (directory: string) => Promise<void>) {
  const directory = await mkdtemp(join(tmpdir(), "sea-water-quality-collector-"));
  try {
    await run(directory);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
}

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

test("runs a single collector for a non-default city, deriving its own cache path and output line", async () => {
  await withCacheDirectory(async (directory) => {
    const cachePath = join(directory, "tivat-sea-water-quality.json");
    const lines: string[] = [];

    const result = await runBudvaSeaWaterQualityCollector({
      cachePath,
      cityId: "tivat",
      refresh: async () => ({
        retainedPreviousSnapshot: false,
        snapshot: null,
        success: true,
        totalLocations: 10,
        warnings: [],
      }),
      writeOutput: (line) => lines.push(line),
    });

    assert.equal(result.cityId, "tivat");
    assert.equal(result.exitCode, 0);
    assert.match(lines[0] ?? "", /provider=sea-water-quality/);
    assert.match(lines[0] ?? "", /city=tivat/);
    assert.match(lines[0] ?? "", /accepted=10/);
  });
});

test("getActiveSeaWaterQualityContexts filters to active, capability-supported, provider-known cities", () => {
  const bar = city({ capabilities: ["seaWaterQuality"], id: "bar", slug: "bar" });
  const budva = city({ capabilities: ["seaWaterQuality"], id: "budva", slug: "budva" });
  const kotor = city({ capabilities: ["seaWaterQuality"], id: "kotor", slug: "kotor" });
  const tivat = city({ capabilities: ["seaWaterQuality"], id: "tivat", slug: "tivat" });
  const unsupportedCapability = city({ capabilities: [], id: "podgorica", slug: "podgorica" });
  const unknownToProvider = city({
    capabilities: ["seaWaterQuality"],
    id: "unknown-city",
    slug: "unknown-city",
  });
  const inactive = city({
    capabilities: ["seaWaterQuality"],
    id: "inactive-city",
    isActive: false,
    slug: "inactive-city",
  });

  const contexts = getActiveSeaWaterQualityContexts(
    [bar, budva, kotor, tivat, unsupportedCapability, unknownToProvider, inactive],
    (cityId) =>
      createCityContext(
        cityId === "bar" || cityId === "budva" || cityId === "kotor" || cityId === "tivat"
          ? cityId
          : "podgorica",
      ),
  );

  assert.deepEqual(
    contexts.map((context) => context.city.id),
    ["bar", "budva", "kotor", "tivat"],
  );
});

test("runActiveSeaWaterQualityCollectors runs one collector per active supported city in order", async () => {
  const bar = city({ capabilities: ["seaWaterQuality"], id: "bar", slug: "bar" });
  const budva = city({ capabilities: ["seaWaterQuality"], id: "budva", slug: "budva" });
  const kotor = city({ capabilities: ["seaWaterQuality"], id: "kotor", slug: "kotor" });
  const tivat = city({ capabilities: ["seaWaterQuality"], id: "tivat", slug: "tivat" });
  const calledFor: string[] = [];

  const results = await runActiveSeaWaterQualityCollectors({
    cities: [bar, budva, kotor, tivat],
    createContext: (cityId) =>
      createCityContext(
        cityId === "bar" || cityId === "budva" || cityId === "kotor" ? cityId : "tivat",
      ),
    runCollector: async (cityId) => {
      calledFor.push(cityId);
      const result: BudvaSeaWaterQualityCollectorResult = {
        cityId,
        exitCode: 0,
        output: `provider=sea-water-quality city=${cityId} state=success`,
        refresh: null,
        state: "success",
      };
      return result;
    },
  });

  assert.deepEqual(calledFor, ["bar", "budva", "kotor", "tivat"]);
  assert.deepEqual(
    results.map(({ cityId }) => cityId),
    ["bar", "budva", "kotor", "tivat"],
  );
});
