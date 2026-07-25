import assert from "node:assert/strict";
import test from "node:test";

import { createFileSnapshotDiagnostic, emitSnapshotDiagnostics } from "./snapshot-diagnostics.ts";

interface TestSnapshot {
  fetchedAt: string;
  records: readonly { timestamp: string }[];
}

test("reports safe metadata for a readable snapshot", async () => {
  const diagnostic = await createFileSnapshotDiagnostic<
    TestSnapshot,
    TestSnapshot["records"][number]
  >({
    cachePath: "/runtime/cache/example.json",
    fileExists: async () => true,
    getDisplayableRecordCount: (records, now) =>
      records.filter((record) => record.timestamp >= now.toISOString()).length,
    getFetchedAt: (snapshot) => snapshot.fetchedAt,
    getRecords: (snapshot) => snapshot.records,
    getRelevantTimestamp: (record) => record.timestamp,
    now: new Date("2026-07-25T10:00:00.000Z"),
    readSnapshot: async () => ({
      fetchedAt: "2026-07-25T09:55:00.000Z",
      records: [
        { timestamp: "2026-07-25T09:00:00.000Z" },
        { timestamp: "2026-07-25T12:00:00.000Z" },
        { timestamp: "2026-07-25T15:00:00.000Z" },
      ],
    }),
    relevantTimestampTimeZone: "UTC",
  });

  assert.deepEqual(diagnostic, {
    cachePath: "/runtime/cache/example.json",
    currentPodgoricaTime: "2026-07-25T12:00:00 Europe/Podgorica",
    currentUtcTime: "2026-07-25T10:00:00.000Z",
    displayableRecordCount: 2,
    earliestRelevantTimestamp: "2026-07-25T09:00:00.000Z",
    exists: true,
    fetchedAt: "2026-07-25T09:55:00.000Z",
    latestRelevantTimestamp: "2026-07-25T15:00:00.000Z",
    relevantTimestampTimeZone: "UTC",
    state: "available",
    totalRecordCount: 3,
  });
});

test("reports a missing snapshot without throwing", async () => {
  const diagnostic = await createFileSnapshotDiagnostic<
    TestSnapshot,
    TestSnapshot["records"][number]
  >({
    cachePath: "/runtime/cache/missing.json",
    fileExists: async () => false,
    getDisplayableRecordCount: () => 0,
    getFetchedAt: (snapshot) => snapshot.fetchedAt,
    getRecords: (snapshot) => snapshot.records,
    getRelevantTimestamp: (record) => record.timestamp,
    now: new Date("2026-07-25T10:00:00.000Z"),
    readSnapshot: async () => null,
    relevantTimestampTimeZone: "Europe/Podgorica",
  });

  assert.deepEqual(diagnostic, {
    cachePath: "/runtime/cache/missing.json",
    currentPodgoricaTime: "2026-07-25T12:00:00 Europe/Podgorica",
    currentUtcTime: "2026-07-25T10:00:00.000Z",
    displayableRecordCount: 0,
    exists: false,
    relevantTimestampTimeZone: "Europe/Podgorica",
    state: "missing",
    totalRecordCount: 0,
  });
});

test("reports a malformed snapshot without throwing", async () => {
  const diagnostic = await createFileSnapshotDiagnostic<
    TestSnapshot,
    TestSnapshot["records"][number]
  >({
    cachePath: "/runtime/cache/malformed.json",
    fileExists: async () => true,
    getDisplayableRecordCount: () => 0,
    getFetchedAt: (snapshot) => snapshot.fetchedAt,
    getRecords: () => {
      throw new Error("Snapshot records are malformed.");
    },
    getRelevantTimestamp: (record) => record.timestamp,
    now: new Date("2026-07-25T10:00:00.000Z"),
    readSnapshot: async () => ({ fetchedAt: "2026-07-25T09:55:00.000Z", records: [] }),
    relevantTimestampTimeZone: "Europe/Podgorica",
  });

  assert.equal(diagnostic.exists, true);
  assert.equal(diagnostic.state, "unreadable");
  assert.equal(diagnostic.totalRecordCount, 0);
});

test("emits one parseable structured diagnostic line", () => {
  const descriptor = Object.getOwnPropertyDescriptor(console, "info");
  const calls: unknown[][] = [];
  Object.defineProperty(console, "info", {
    configurable: true,
    value: (...arguments_: unknown[]) => calls.push(arguments_),
  });

  try {
    emitSnapshotDiagnostics({
      flights: {
        cachePath: "/runtime/cache/flights.json",
        currentPodgoricaTime: "2026-07-25T12:00:00 Europe/Podgorica",
        currentUtcTime: "2026-07-25T10:00:00.000Z",
        displayableRecordCount: 2,
        exists: true,
        relevantTimestampTimeZone: "UTC",
        state: "available",
        totalRecordCount: 3,
      },
    });
  } finally {
    if (descriptor) Object.defineProperty(console, "info", descriptor);
  }

  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.length, 1);
  assert.equal(typeof calls[0]?.[0], "string");
  assert.deepEqual(JSON.parse(String(calls[0]?.[0])), {
    event: "snapshot-diagnostics",
    snapshots: {
      flights: {
        cachePath: "/runtime/cache/flights.json",
        currentPodgoricaTime: "2026-07-25T12:00:00 Europe/Podgorica",
        currentUtcTime: "2026-07-25T10:00:00.000Z",
        displayableRecordCount: 2,
        exists: true,
        relevantTimestampTimeZone: "UTC",
        state: "available",
        totalRecordCount: 3,
      },
    },
  });
});
