import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateFreshness,
  CedisCacheError,
  readCedisCacheResult,
  writeCedisCache,
  type CacheFileSystem,
  type CedisCacheSnapshot,
} from "./cedis-cache.ts";
import { createRefreshResult } from "./cedis-refresh.ts";

const snapshot = (): CedisCacheSnapshot => ({
  alerts: [],
  fetchedAt: "2026-07-17T10:00:00.000Z",
  freshnessStatus: "fresh",
  lastSuccessfulRefreshAt: "2026-07-17T10:00:00.000Z",
  parserWarnings: [],
  schemaVersion: 1,
  source: "CEDIS",
  sourceUrl: "https://cedis.me/servisne-informacije/",
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
  const now = new Date("2026-07-17T12:00:00Z");
  assert.equal(calculateFreshness(new Date("2026-07-17T11:00:00Z"), now, 90), "fresh");
  assert.equal(calculateFreshness(new Date("2026-07-17T10:00:00Z"), now, 90), "stale");
  assert.equal(calculateFreshness(undefined, now), "unavailable");
});

test("retains a valid cache when an empty parse is suspicious", () => {
  const previous = { ...snapshot(), alerts: [{ id: "saved" }] as never[] };
  const result = createRefreshResult(
    {
      alerts: [],
      inspectedArticles: 2,
      parserWarnings: ["Unexpected markup"],
      sourceUrl: previous.sourceUrl,
    },
    previous,
  );
  assert.equal(result.retainedPreviousSnapshot, true);
  assert.equal(result.snapshot?.freshnessStatus, "stale");
});

test("allows a confidently valid empty result", () => {
  const result = createRefreshResult(
    {
      alerts: [],
      inspectedArticles: 2,
      parserWarnings: [],
      sourceUrl: "https://cedis.me/servisne-informacije/",
    },
    null,
  );
  assert.equal(result.success, true);
  assert.equal(result.classification, "trustworthy-empty");
});

test("returns a normalized read error for invalid cache JSON", async () => {
  const result = await readCedisCacheResult(
    "cache.json",
    fileSystem({ readFile: async () => "{" }),
  );
  assert.equal(result.snapshot, null);
  assert.equal(result.error?.code, "cache-invalid-json");
});

test("rejects legacy cached CEDIS alerts that contain embedded-code artifacts", async () => {
  const pollutedSnapshot: CedisCacheSnapshot = {
    ...snapshot(),
    alerts: [
      {
        affectedArea: {
          kind: "source",
          value:
            "none;} window.lazySizesConfig=window.lazySizesConfig||{};window.lazySizesConfig.loadMode=1;",
        },
        cityIds: ["podgorica"],
        dataMode: "live",
        description: { kind: "source", value: "Planirano isključenje." },
        id: "polluted-legacy-alert",
        publishedAt: new Date("2026-07-04T12:00:00.000Z"),
        severity: "information",
        source: { kind: "source", value: "CEDIS" },
        startsAt: new Date("2026-07-04T12:00:00.000Z"),
        status: "active",
        title: { kind: "source", value: "Planirano isključenje struje" },
        type: "powerOutage",
      },
    ],
  };

  const result = await readCedisCacheResult(
    "cache.json",
    fileSystem({ readFile: async () => JSON.stringify(pollutedSnapshot) }),
  );

  assert.equal(result.snapshot, null);
  assert.equal(result.error?.code, "cache-invalid-json");
});

test("returns a normalized read error for a permission failure", async () => {
  const result = await readCedisCacheResult(
    "cache.json",
    fileSystem({
      readFile: async () => {
        throw Object.assign(new Error("denied"), { code: "EACCES" });
      },
    }),
  );
  assert.equal(result.error?.code, "cache-read-failed");
});

test("restores alert timestamps from JSON before homepage date mapping", async () => {
  const cachedSnapshot: CedisCacheSnapshot = {
    ...snapshot(),
    alerts: [
      {
        affectedArea: { kind: "source", value: "Centar" },
        cityIds: ["podgorica"],
        dataMode: "live",
        description: { kind: "source", value: "Planirano isključenje." },
        expectedEndAt: new Date("2026-07-21T11:00:00.000Z"),
        id: "cedis-podgorica-1",
        publishedAt: new Date("2026-07-20T18:00:00.000Z"),
        severity: "information",
        source: { kind: "source", value: "CEDIS" },
        sourceUrl: "https://cedis.me/servisne-informacije/obavjestenje",
        startsAt: new Date("2026-07-21T08:00:00.000Z"),
        status: "scheduled",
        title: { kind: "source", value: "Planirano isključenje struje" },
        type: "powerOutage",
      },
    ],
  };
  const result = await readCedisCacheResult(
    "cache.json",
    fileSystem({ readFile: async () => JSON.stringify(cachedSnapshot) }),
  );

  const timestamps = result.snapshot?.alerts
    .map((alert) => [alert.startsAt, alert.expectedEndAt, alert.publishedAt])
    .flat()
    .filter((value): value is Date => value !== undefined)
    .map((value) => value.toISOString());

  assert.deepEqual(timestamps, [
    "2026-07-21T08:00:00.000Z",
    "2026-07-21T11:00:00.000Z",
    "2026-07-20T18:00:00.000Z",
  ]);
});

for (const [name, failure] of [
  ["directory creation", "mkdir"],
  ["temporary file write", "writeFile"],
  ["atomic rename", "rename"],
] as const) {
  test(`keeps the active cache intact when ${name} fails`, async () => {
    const calls: string[] = [];
    const failingFileSystem = fileSystem({
      [failure]: async () => {
        calls.push(failure);
        throw new Error("filesystem failure");
      },
      rm: async (path) => {
        calls.push(`rm:${path}`);
      },
    });
    await assert.rejects(
      writeCedisCache(snapshot(), "cache.json", failingFileSystem),
      (error: unknown) => error instanceof CedisCacheError && error.code === "cache-write-failed",
    );
    assert.ok(calls.includes(failure));
    assert.ok(calls.includes("rm:cache.json.tmp"));
  });
}
