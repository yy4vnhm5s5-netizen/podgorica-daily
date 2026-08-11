import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { readParkingCache } from "./parking-cache.ts";
import { refreshParkingAvailability } from "./parking-refresh.ts";
import type { ParkingServisHttpClient } from "./parking-servis-podgorica.ts";

const validBody = JSON.stringify([
  {
    name: null,
    parking_id: "broj1",
    slobodnih_mjesta: 260,
    time_updated: 1786442100,
  },
]);

function response(body: string): ParkingServisHttpClient {
  return {
    get: async () => ({ body, contentType: "text/html", status: 200 }),
  };
}

test("writes the validated availability snapshot atomically after a successful refresh", async () => {
  const directory = await mkdtemp(join(tmpdir(), "gradom-parking-refresh-"));
  const cachePath = join(directory, "parking.json");

  try {
    const result = await refreshParkingAvailability({
      cachePath,
      httpClient: response(validBody),
      now: () => new Date("2026-08-11T10:00:00.000Z"),
    });

    assert.equal(result.success, true);
    assert.equal(result.acceptedLocations, 1);
    assert.equal(result.snapshot?.locations[0]?.sourceId, "broj1");
    assert.equal((await readParkingCache(cachePath))?.locations[0]?.freeSpaces, 260);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

test("retains a previous snapshot after a failed collection without refreshing source timestamps", async () => {
  const directory = await mkdtemp(join(tmpdir(), "gradom-parking-retention-"));
  const cachePath = join(directory, "parking.json");
  const refreshedAt = new Date("2026-08-11T10:00:00.000Z");

  try {
    await refreshParkingAvailability({
      cachePath,
      httpClient: response(validBody),
      now: () => refreshedAt,
    });
    const result = await refreshParkingAvailability({
      cachePath,
      httpClient: {
        get: async () => {
          throw new Error("source unavailable");
        },
      },
      now: () => new Date("2026-08-11T10:30:00.000Z"),
    });

    assert.equal(result.success, false);
    assert.equal(result.retainedPreviousSnapshot, true);
    assert.equal(
      result.snapshot?.locations[0]?.sourceUpdatedAt,
      new Date(1786442100 * 1000).toISOString(),
    );
    assert.equal(result.snapshot?.fetchedAt, refreshedAt.toISOString());
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

test("retains the prior snapshot when the source payload has no usable known locations", async () => {
  const directory = await mkdtemp(join(tmpdir(), "gradom-parking-no-valid-records-"));
  const cachePath = join(directory, "parking.json");

  try {
    await refreshParkingAvailability({
      cachePath,
      httpClient: response(validBody),
      now: () => new Date("2026-08-11T10:00:00.000Z"),
    });
    const result = await refreshParkingAvailability({
      cachePath,
      httpClient: response(
        JSON.stringify([
          {
            name: "unknown",
            parking_id: "unknown",
            slobodnih_mjesta: 2,
            time_updated: 1786442100,
          },
        ]),
      ),
      now: () => new Date("2026-08-11T10:05:00.000Z"),
    });

    assert.equal(result.success, false);
    assert.equal(result.errorCode, "parking-response-no-valid-locations");
    assert.equal(result.retainedPreviousSnapshot, true);
    assert.equal(result.snapshot?.locations[0]?.sourceId, "broj1");
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});
