import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";

import {
  assertMonteGigsUrl,
  createMonteGigsHttpClient,
  getCachedMonteGigsGoingOut,
  parseMonteGigsPodgoricaEvents,
  refreshMonteGigsGoingOut,
} from "./montegigs-going-out.ts";

const fixturePath = join(import.meta.dirname, "__fixtures__", "montegigs-podgorica-listing.html");

test("parses only Podgorica events from the official-style listing fixture", async () => {
  const html = await readFile(fixturePath, "utf8");
  const parsed = parseMonteGigsPodgoricaEvents(html, new Date("2026-07-22T10:00:00.000Z"));

  assert.equal(parsed.recognized, true);
  assert.equal(parsed.records, 2);
  assert.equal(parsed.rejected, 0);
  assert.deepEqual(
    parsed.events.map(({ startDate, title, venue }) => ({ startDate, title, venue })),
    [
      {
        startDate: "2026-08-25",
        title: "Summer Jam: Željko Samardžić",
        venue: "Elit Restoran Bar",
      },
      { startDate: "2026-08-25", title: "Late DJ Set", venue: "Klub Kultura" },
    ],
  );
  assert.equal(parsed.events[1]?.startsAt, "2026-08-25T20:30:00.000Z");
  assert.equal(parsed.events[0]?.imageUrl, "https://staging.montegigs.me/images/summer-jam.jpg");
});

test("retains a valid cache when the listing no longer exposes event links", async () => {
  const cachePath = join(await mkdtemp(join(tmpdir(), "gradom-going-out-")), "going-out.json");
  const validHtml = await readFile(fixturePath, "utf8");
  const first = await refreshMonteGigsGoingOut({
    cachePath,
    httpClient: { get: async () => response(validHtml) },
    now: new Date("2026-07-22T10:00:00.000Z"),
  });
  const retained = await refreshMonteGigsGoingOut({
    cachePath,
    httpClient: { get: async () => response("<html><main><p>Maintenance</p></main></html>") },
    now: new Date("2026-07-22T11:00:00.000Z"),
  });

  assert.equal(first.success, true);
  assert.equal(retained.success, false);
  assert.equal(retained.retainedPreviousSnapshot, true);
  assert.equal(retained.snapshot?.events.length, 2);
});

test("reads the atomically written cache without a live request", async () => {
  const cachePath = join(
    await mkdtemp(join(tmpdir(), "gradom-going-out-cache-")),
    "going-out.json",
  );
  const html = await readFile(fixturePath, "utf8");
  await refreshMonteGigsGoingOut({
    cachePath,
    httpClient: { get: async () => response(html) },
    now: new Date("2026-07-22T10:00:00.000Z"),
  });

  const cached = await getCachedMonteGigsGoingOut(cachePath, new Date("2026-07-22T14:01:00.000Z"));
  assert.equal(cached.state, "stale");
  assert.equal(cached.events.length, 2);
});

test("allows only the configured MonteGigs listing host", () => {
  assert.doesNotThrow(() => assertMonteGigsUrl("https://staging.montegigs.me/me/events/podgorica"));
  assert.throws(() => assertMonteGigsUrl("https://example.test/me/events/podgorica"));
});

test("retries a transient MonteGigs response through the injected client", async () => {
  let calls = 0;
  const client = createMonteGigsHttpClient({
    fetchImplementation: async () => {
      calls += 1;
      return calls === 1
        ? {
            ok: false,
            status: 503,
            text: async () => "",
            url: "https://staging.montegigs.me/me/events/podgorica",
          }
        : {
            headers: { get: () => "text/html" },
            ok: true,
            status: 200,
            text: async () => "<html></html>",
            url: "https://staging.montegigs.me/me/events/podgorica",
          };
    },
  });

  const value = await client.get("https://staging.montegigs.me/me/events/podgorica");
  assert.equal(calls, 2);
  assert.equal(value.status, 200);
});

function response(body: string) {
  return {
    body,
    contentType: "text/html",
    finalUrl: "https://staging.montegigs.me/me/events/podgorica",
    requestedUrl: "https://staging.montegigs.me/me/events/podgorica",
    status: 200,
  };
}
