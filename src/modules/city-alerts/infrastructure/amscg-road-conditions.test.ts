import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { readAmscgCache, writeAmscgCache } from "./amscg-cache.ts";
import { assertAmscgUrl, createAmscgHttpClient, AmscgFetchError } from "./amscg-http-client.ts";
import { parseAmscgRoadConditions } from "./amscg-road-conditions.ts";
import { refreshAmscg } from "./amscg-refresh.ts";

const fixture = () =>
  readFile(new URL("./__fixtures__/amscg-road-conditions.html", import.meta.url), "utf8");

test("normalizes official road works, closures, restrictions, and warnings", async () => {
  const result = parseAmscgRoadConditions(await fixture());
  assert.equal(result.contentRecognized, true);
  assert.deepEqual(
    result.alerts.map((alert) => alert.type),
    ["alternating", "closure", "restriction", "warning"],
  );
  assert.equal(result.alerts[0]?.affectedRoad, "Podgorica - Kolašin");
  assert.equal(result.alerts[0]?.municipality, "Podgorica");
  assert.equal(result.alerts[0]?.sourceUrl, "https://amscg.org/stanje-na-putevima/");
});

test("rejects arbitrary non-AMSCG URLs", () => {
  assert.throws(
    () => assertAmscgUrl("https://example.com/stanje-na-putevima/"),
    (error: unknown) => error instanceof AmscgFetchError && error.code === "amscg-host-rejected",
  );
});

test("refreshes fixture content through an injected HTTP client", async () => {
  let written = false;
  const result = await refreshAmscg({
    cache: {
      read: async () => null,
      write: async () => {
        written = true;
      },
    },
    httpClient: { get: fixture },
    now: () => new Date("2026-07-17T10:00:00.000Z"),
  });
  assert.equal(result.success, true);
  assert.equal(result.snapshot?.alerts.length, 4);
  assert.equal(written, true);
});

test("restores cached road-alert timestamps before City Alerts maps them", async () => {
  const directory = await mkdtemp(join(tmpdir(), "amscg-cache-"));
  const cachePath = join(directory, "amscg.json");

  try {
    await writeAmscgCache(
      {
        alerts: [
          {
            affectedRoad: "Podgorica - Kolašin",
            cityIds: ["podgorica"],
            description: "Alternativno odvijanje saobraćaja.",
            id: "amscg-1",
            source: "AMSCG",
            sourceUrl: "https://amscg.org/stanje-na-putevima/",
            title: "Radovi na putu",
            type: "alternating",
            validFrom: new Date("2026-07-21T08:00:00.000Z"),
            validUntil: new Date("2026-07-21T12:00:00.000Z"),
          },
        ],
        fetchedAt: "2026-07-21T07:00:00.000Z",
        freshnessStatus: "fresh",
        lastSuccessfulRefreshAt: "2026-07-21T07:00:00.000Z",
        parserWarnings: [],
        schemaVersion: 1,
        source: "AMSCG",
        sourceUrl: "https://amscg.org/stanje-na-putevima/",
      },
      cachePath,
    );
    const snapshot = await readAmscgCache(cachePath);

    assert.deepEqual(
      snapshot?.alerts
        .flatMap(({ validFrom, validUntil }) => [validFrom, validUntil])
        .filter((value): value is Date => value !== undefined)
        .map((value) => value.toISOString()),
      ["2026-07-21T08:00:00.000Z", "2026-07-21T12:00:00.000Z"],
    );
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

test("uses the bounded retry policy for a failed request", async () => {
  let attempts = 0;
  const client = createAmscgHttpClient({
    fetchImplementation: async () => {
      attempts += 1;
      return { ok: false, status: 503, text: async () => "unavailable" };
    },
  });
  await assert.rejects(client.get("https://amscg.org/stanje-na-putevima/"), AmscgFetchError);
  assert.equal(attempts, 2);
});
