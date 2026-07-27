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

test("drops a cached event whose startsAt is not a valid timestamp and has no valid startDate fallback", async () => {
  const snapshot = await readEvents([
    event({ cityId: "podgorica", id: "event_bad_startsat", startDate: undefined, startsAt: "07/28/2026" }),
  ]);
  assert.deepEqual(snapshot?.events, []);
});

test("keeps a cached event's valid startDate when its startsAt is malformed, dropping only the bad field", async () => {
  const snapshot = await readEvents([
    event({
      cityId: "podgorica",
      id: "event_partial_bad_startsat",
      startDate: "2026-07-28",
      startsAt: "not-a-real-timestamp",
    }),
  ]);
  assert.equal(snapshot?.events[0]?.id, "event_partial_bad_startsat");
  assert.equal(snapshot?.events[0]?.startsAt, undefined);
  assert.equal(snapshot?.events[0]?.startDate, "2026-07-28");
});

test("drops a malformed endsAt while keeping an otherwise valid cached event", async () => {
  const snapshot = await readEvents([
    event({
      cityId: "podgorica",
      endsAt: "not-a-real-timestamp",
      id: "event_bad_endsat",
      startsAt: "2026-07-28T18:00:00.000Z",
    }),
  ]);
  assert.equal(snapshot?.events[0]?.id, "event_bad_endsat");
  assert.equal(snapshot?.events[0]?.startsAt, "2026-07-28T18:00:00.000Z");
  assert.equal(snapshot?.events[0]?.endsAt, undefined);
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
