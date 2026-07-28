import assert from "node:assert/strict";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { refreshBudvaSeaWaterQuality } from "./budva-sea-water-quality-refresh.ts";
import type { MorskodobroHttpClient } from "./morskodobro-http-client.ts";

async function readFixture(name: string) {
  return readFile(new URL(`./__fixtures__/${name}`, import.meta.url), "utf8");
}

async function withTempCachePath(run: (cachePath: string) => Promise<void>) {
  const directory = await mkdtemp(join(tmpdir(), "sea-water-quality-"));
  try {
    await run(join(directory, "cache.json"));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("writes a fresh snapshot on a successful refresh", async () => {
  await withTempCachePath(async (cachePath) => {
    const calendarBody = await readFixture("morskodobro-calendar-data.json");
    const mapBody = await readFixture("morskodobro-budva-map-data.json");
    const httpClient: MorskodobroHttpClient = {
      post: async (url) =>
        url.includes("getCalendarData") ? calendarBody : mapBody,
    };

    const result = await refreshBudvaSeaWaterQuality({
      cachePath,
      httpClient,
      now: () => new Date("2026-07-24T10:00:00.000Z"),
    });

    assert.equal(result.success, true);
    assert.equal(result.totalLocations, 34);
    assert.equal(result.snapshot?.summary.gradeCounts.excellent, 27);
    assert.equal(result.snapshot?.summary.latestSamplingDate, "2026-07-23");
    assert.deepEqual(result.warnings, []);
    assert.deepEqual(result.snapshot?.parserWarnings, []);
  });
});

test("surfaces a parser warning via the diagnostic emitter without failing the refresh", async () => {
  await withTempCachePath(async (cachePath) => {
    const calendarBody = await readFixture("morskodobro-calendar-data.json");
    const mapBody = JSON.stringify({
      mjerenja: [{ datumUzorkovanja: "24.07.2026", opstina: "Budva", tezina: 1 }],
      sumarno: [
        [1, 30],
        [5, 2],
      ],
      ukupno: 32,
    });
    const httpClient: MorskodobroHttpClient = {
      post: async (url) => (url.includes("getCalendarData") ? calendarBody : mapBody),
    };
    const diagnostics: Record<string, unknown>[] = [];

    const result = await refreshBudvaSeaWaterQuality({
      cachePath,
      diagnostic: (payload) => diagnostics.push(payload),
      httpClient,
      now: () => new Date("2026-07-24T10:00:00.000Z"),
    });

    assert.equal(result.success, true);
    assert.equal(result.totalLocations, 32);
    assert.deepEqual(result.warnings, ["sea-water-quality-unknown-tezina:5"]);
    assert.deepEqual(result.snapshot?.parserWarnings, ["sea-water-quality-unknown-tezina:5"]);
    assert.equal(diagnostics.length, 1);
    assert.equal(diagnostics[0]?.event, "sea-water-quality-parser-warning");
  });
});

test("retains the previous snapshot when the upstream request fails", async () => {
  await withTempCachePath(async (cachePath) => {
    const calendarBody = await readFixture("morskodobro-calendar-data.json");
    const mapBody = await readFixture("morskodobro-budva-map-data.json");
    const workingClient: MorskodobroHttpClient = {
      post: async (url) => (url.includes("getCalendarData") ? calendarBody : mapBody),
    };
    await refreshBudvaSeaWaterQuality({
      cachePath,
      httpClient: workingClient,
      now: () => new Date("2026-07-24T10:00:00.000Z"),
    });

    const failingClient: MorskodobroHttpClient = {
      post: async () => {
        throw new Error("network down");
      },
    };
    const result = await refreshBudvaSeaWaterQuality({
      cachePath,
      httpClient: failingClient,
      now: () => new Date("2026-07-25T10:00:00.000Z"),
    });

    assert.equal(result.success, false);
    assert.equal(result.retainedPreviousSnapshot, true);
    assert.equal(result.snapshot?.summary.totalLocations, 34);
    assert.equal(result.snapshot?.lastRefreshError, "sea-water-quality-refresh-failed");
  });
});

test("retains previous snapshot without throwing when there is no prior cache and the request fails", async () => {
  await withTempCachePath(async (cachePath) => {
    const failingClient: MorskodobroHttpClient = {
      post: async () => {
        throw new Error("network down");
      },
    };
    const result = await refreshBudvaSeaWaterQuality({
      cachePath,
      httpClient: failingClient,
    });

    assert.equal(result.success, false);
    assert.equal(result.retainedPreviousSnapshot, false);
    assert.equal(result.snapshot, null);
    assert.equal(result.totalLocations, 0);
  });
});

test("retains the previous snapshot when the calendar response cannot be recognized", async () => {
  await withTempCachePath(async (cachePath) => {
    const httpClient: MorskodobroHttpClient = {
      post: async () => "not json",
    };
    const result = await refreshBudvaSeaWaterQuality({ cachePath, httpClient });

    assert.equal(result.success, false);
    assert.equal(result.errorCode, "sea-water-quality-calendar-unrecognized");
  });
});
