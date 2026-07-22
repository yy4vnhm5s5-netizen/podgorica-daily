import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { readEventCacheSnapshot } from "./events-cache.ts";

function event(overrides: Record<string, unknown> = {}) {
  return {
    category: "concert",
    id: "legacy-event",
    language: "me",
    sourceId: "legacy",
    sourceName: "Legacy source",
    sourceReferences: [],
    sourceUrl: "https://events.example.test/legacy-event",
    startDate: "2026-07-23",
    status: "scheduled",
    tags: [],
    timezone: "Europe/Podgorica",
    title: "Legacy event",
    ...overrides,
  };
}

async function readEvents(events: Record<string, unknown>[]) {
  const directory = await mkdtemp(join(tmpdir(), "gradom-events-cache-"));
  const cachePath = join(directory, "events.json");

  try {
    await writeFile(
      cachePath,
      JSON.stringify({
        events,
        fetchedAt: "2026-07-22T10:00:00.000Z",
        freshnessStatus: "fresh",
        lastSuccessfulRefreshAt: "2026-07-22T10:00:00.000Z",
        parserWarnings: [],
        provider: {
          displayName: "Legacy source",
          id: "legacy",
          sourceUrl: "https://events.example.test",
        },
        schemaVersion: 2,
        venues: [],
      }),
    );
    return await readEventCacheSnapshot(cachePath);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
}

test("preserves a valid current cityId", async () => {
  const snapshot = await readEvents([event({ cityId: "podgorica", cityIds: ["bar"] })]);
  assert.equal(snapshot?.events[0]?.cityId, "podgorica");
});

test("backfills one valid legacy cityIds value", async () => {
  const snapshot = await readEvents([event({ cityIds: ["podgorica"] })]);
  assert.equal(snapshot?.events[0]?.cityId, "podgorica");
});

test("backfills repeated legacy cityIds values when they resolve to one city", async () => {
  const snapshot = await readEvents([event({ cityIds: ["podgorica", "podgorica"] })]);
  assert.equal(snapshot?.events[0]?.cityId, "podgorica");
});

test("drops empty, ambiguous, unknown, and prototype legacy city values", async () => {
  const snapshot = await readEvents([
    event({ cityIds: ["podgorica", "bar"] }),
    event({ cityIds: [], id: "empty" }),
    event({ cityId: "constructor", id: "constructor" }),
    event({ cityId: "__proto__", id: "proto" }),
    event({ cityIds: ["toString"], id: "prototype" }),
    event({ cityIds: ["unknown"], id: "unknown" }),
    event({ id: "without-city" }),
  ]);
  assert.deepEqual(snapshot?.events, []);
});
