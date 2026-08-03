import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  backfillSeaWaterQualityHistory,
  isValidBackfillYear,
  resolveBackfillRounds,
} from "./sea-water-quality-history-backfill.ts";
import { readSeaWaterQualityHistoryCache } from "./sea-water-quality-history-cache.ts";
import type { MorskodobroHttpClient } from "./morskodobro-http-client.ts";
import type { SeaWaterQualitySupportedCityId } from "./sea-water-quality-cities.ts";

const year = 2026;

async function readFixture(name: string) {
  return readFile(new URL(`./__fixtures__/${name}`, import.meta.url), "utf8");
}

async function withTempDirectory(run: (directory: string) => Promise<void>) {
  const directory = await mkdtemp(join(tmpdir(), "sea-water-backfill-"));
  try {
    await run(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function pathResolvers(directory: string) {
  return {
    resolveCachePath: (cityId: SeaWaterQualitySupportedCityId) =>
      join(directory, `${cityId}-sea-water-quality.json`),
    resolveHistoryCachePath: (cityId: SeaWaterQualitySupportedCityId) =>
      join(directory, `${cityId}-sea-water-quality-history.json`),
  };
}

// Serves the official calendar plus the requested national round fixture, recording every request
// so the per-city/per-round fetch pattern can be asserted.
async function createHttpClient(
  overrides: { failRounds?: readonly number[] } = {},
): Promise<{ client: MorskodobroHttpClient; requests: URLSearchParams[] }> {
  const [calendar, round4, round5] = await Promise.all([
    readFixture("morskodobro-calendar-data.json"),
    readFixture("jpmd-2026-round-4-full.json"),
    readFixture("jpmd-2026-round-5-full.json"),
  ]);
  const requests: URLSearchParams[] = [];

  return {
    client: {
      post: async (url, body) => {
        if (url.includes("getCalendarData")) return calendar;
        requests.push(body);
        const round = Number(body.get("rb"));
        if (overrides.failRounds?.includes(round)) throw new Error("upstream exploded");
        return round === 5 ? round5 : round4;
      },
    },
    requests,
  };
}

test("rejects years and rounds that are not officially available", async () => {
  assert.equal(isValidBackfillYear(2026), true);
  assert.equal(isValidBackfillYear(1999), false);
  assert.equal(isValidBackfillYear(2026.5), false);
  assert.equal(isValidBackfillYear(Number.NaN), false);

  const resolved = resolveBackfillRounds({
    calendarRounds: [1, 2, 3, 4, 5],
    requestedRounds: [4, 4, 2, -2026, 0, 9, 6, 2.5],
    selectedRound: 5,
  });

  // Deduplicated, ascending, and free of the negative season pseudo-entry.
  assert.deepEqual(resolved.resolvedRounds, [2, 4]);
  assert.deepEqual(resolved.rejectedRounds, [-2026, 0, 9, 6, 2.5]);
});

test("never accepts a round newer than the calendar's currently selected round", () => {
  const resolved = resolveBackfillRounds({
    calendarRounds: [1, 2, 3, 4, 5],
    requestedRounds: [3, 5],
    selectedRound: 3,
  });

  assert.deepEqual(resolved.resolvedRounds, [3]);
  assert.deepEqual(resolved.rejectedRounds, [5]);
});

test("returns bad-request without any upstream round fetch for invalid input", async () => {
  await withTempDirectory(async (directory) => {
    const { client, requests } = await createHttpClient();
    const result = await backfillSeaWaterQualityHistory(
      { rounds: [], year },
      { httpClient: client, ...pathResolvers(directory) },
    );

    assert.equal(result.state, "bad-request");
    assert.equal(result.errorCode, "sea-water-quality-backfill-invalid-request");
    assert.deepEqual(requests, []);
  });
});

test("backfills every supported city from one fetch per city and round", async () => {
  await withTempDirectory(async (directory) => {
    const { client, requests } = await createHttpClient();
    const result = await backfillSeaWaterQualityHistory(
      { rounds: [4, 5], year },
      {
        httpClient: client,
        now: () => new Date("2026-08-01T00:00:00.000Z"),
        ...pathResolvers(directory),
      },
    );

    assert.equal(result.state, "success");
    assert.deepEqual(result.resolvedRounds, [4, 5]);
    assert.deepEqual(
      result.cities.map((city) => city.cityId).sort(),
      ["bar", "budva", "kotor", "tivat"],
    );
    // 4 supported cities x 2 rounds, using the verified municipality ids only.
    assert.equal(requests.length, 8);
    assert.deepEqual(
      [...new Set(requests.map((request) => request.get("opstina")))].sort(),
      ["1", "2", "3", "4"],
    );
    assert.deepEqual([...new Set(requests.map((request) => request.get("godina")))], ["2026"]);

    const expectedCounts: Record<string, number> = { bar: 15, budva: 34, kotor: 15, tivat: 10 };
    for (const city of result.cities) {
      assert.equal(city.state, "success");
      const snapshot = await readSeaWaterQualityHistoryCache(city.historyPath);
      assert.ok(snapshot, `expected history for ${city.cityId}`);
      assert.equal(snapshot.history.year, year);
      assert.equal(snapshot.history.municipality, city.cityId);
      assert.equal(snapshot.history.locations.length, expectedCounts[city.cityId]);
      for (const location of snapshot.history.locations) {
        assert.deepEqual(
          location.measurements.map((measurement) => measurement.sourceRound),
          [4, 5],
        );
      }
    }
  });
});

test("writes only history and never the current sea-water snapshot", async () => {
  await withTempDirectory(async (directory) => {
    const { client } = await createHttpClient();
    const resolvers = pathResolvers(directory);
    const currentSnapshotPath = resolvers.resolveCachePath("budva");
    // A current snapshot that already reflects the newest normal refresh (round 5).
    const currentSnapshot = JSON.stringify({
      fetchedAt: "2026-07-24T10:00:00.000Z",
      lastSuccessfulRefreshAt: "2026-07-24T10:00:00.000Z",
      parserWarnings: [],
      schemaVersion: 1,
      source: "Javno preduzeće za upravljanje morskim dobrom Crne Gore",
      sourceUrl: "https://monitoring.morskodobro.me",
      summary: { gradeCounts: {}, locations: [], municipality: "budva", totalLocations: 34 },
    });
    await writeFile(currentSnapshotPath, currentSnapshot, "utf8");

    await backfillSeaWaterQualityHistory(
      { rounds: [4], year },
      { httpClient: client, ...resolvers },
    );

    assert.equal(
      await readFile(currentSnapshotPath, "utf8"),
      currentSnapshot,
      "the current snapshot must be byte-identical after a backfill",
    );
  });
});

test("keeps a failing round and a failing city from destroying valid history", async () => {
  await withTempDirectory(async (directory) => {
    const resolvers = pathResolvers(directory);
    const seed = await createHttpClient();
    await backfillSeaWaterQualityHistory(
      { rounds: [5], year },
      { httpClient: seed.client, ...resolvers },
    );
    const before = await readSeaWaterQualityHistoryCache(
      resolvers.resolveHistoryCachePath("budva"),
    );
    assert.ok(before);

    const failing = await createHttpClient({ failRounds: [4] });
    const result = await backfillSeaWaterQualityHistory(
      { rounds: [4], year },
      { httpClient: failing.client, ...resolvers },
    );

    assert.equal(result.state, "failure");
    for (const city of result.cities) {
      assert.equal(city.state, "failed");
      assert.equal(city.rounds[0].errorCode, "sea-water-quality-backfill-failed");
    }
    const after = await readSeaWaterQualityHistoryCache(resolvers.resolveHistoryCachePath("budva"));
    assert.deepEqual(after, before, "previous valid history must survive a failed round");
  });
});

test("reports partial success when only some rounds fail", async () => {
  await withTempDirectory(async (directory) => {
    const { client } = await createHttpClient({ failRounds: [4] });
    const result = await backfillSeaWaterQualityHistory(
      { rounds: [4, 5], year },
      { httpClient: client, ...pathResolvers(directory) },
    );

    assert.equal(result.state, "partial");
    for (const city of result.cities) {
      assert.equal(city.state, "partial");
      assert.deepEqual(
        city.rounds.map((round) => `${round.round}:${round.state}`),
        ["4:failed", "5:success"],
      );
    }
  });
});

test("refuses to overwrite history from a newer season", async () => {
  await withTempDirectory(async (directory) => {
    const resolvers = pathResolvers(directory);
    const newerSeason = {
      fetchedAt: "2027-07-01T00:00:00.000Z",
      history: {
        latestRound: 2,
        locations: [],
        municipality: "budva",
        sourceMunicipalityId: 2,
        year: 2027,
      },
      lastSuccessfulRefreshAt: "2027-07-01T00:00:00.000Z",
      schemaVersion: 1,
      source: "Javno preduzeće za upravljanje morskim dobrom Crne Gore",
      sourceUrl: "https://monitoring.morskodobro.me",
    };
    await writeFile(
      resolvers.resolveHistoryCachePath("budva"),
      JSON.stringify(newerSeason),
      "utf8",
    );

    const { client } = await createHttpClient();
    const result = await backfillSeaWaterQualityHistory(
      { rounds: [4], year },
      { httpClient: client, ...resolvers },
    );

    const budva = result.cities.find((city) => city.cityId === "budva");
    assert.equal(budva?.state, "skipped");
    assert.equal(budva?.errorCode, "sea-water-quality-backfill-newer-season-present");
    const snapshot = await readSeaWaterQualityHistoryCache(
      resolvers.resolveHistoryCachePath("budva"),
    );
    assert.equal(snapshot?.history.year, 2027, "newer season history must be preserved");
  });
});

test("is idempotent across whole reruns", async () => {
  await withTempDirectory(async (directory) => {
    const resolvers = pathResolvers(directory);
    const first = await createHttpClient();
    await backfillSeaWaterQualityHistory(
      { rounds: [4, 5], year },
      { httpClient: first.client, ...resolvers },
    );
    const afterFirst = await readSeaWaterQualityHistoryCache(
      resolvers.resolveHistoryCachePath("budva"),
    );

    const second = await createHttpClient();
    await backfillSeaWaterQualityHistory(
      { rounds: [4, 5, 4], year },
      { httpClient: second.client, ...resolvers },
    );
    const afterSecond = await readSeaWaterQualityHistoryCache(
      resolvers.resolveHistoryCachePath("budva"),
    );

    assert.deepEqual(afterSecond, afterFirst, "a rerun must not change stored history");
  });
});
