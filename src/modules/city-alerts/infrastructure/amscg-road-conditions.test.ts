import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

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
