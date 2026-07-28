import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { tmpdir } from "node:os";

import {
  assertMonteGigsUrl,
  createMonteGigsHttpClient,
  getCachedMonteGigsGoingOut,
  getGoingOutCachePath,
  getMonteGigsCitySource,
  parseMonteGigsEvents,
  refreshMonteGigsGoingOut,
} from "./montegigs-going-out.ts";
import { createCityContext } from "@/shared/config/cities";

const podgoricaFixturePath = join(
  import.meta.dirname,
  "__fixtures__",
  "montegigs-podgorica-listing.html",
);
const budvaFixturePath = join(import.meta.dirname, "__fixtures__", "montegigs-budva-listing.html");
const podgorica = createCityContext("podgorica");
const budva = createCityContext("budva");
const tivat = createCityContext("tivat");

test("parses only Podgorica events from the official-style listing fixture", async () => {
  const html = await readFile(podgoricaFixturePath, "utf8");
  const parsed = parseMonteGigsEvents(html, podgorica, new Date("2026-07-22T10:00:00.000Z"));

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
  assert.deepEqual(
    parsed.events.map((event) => event.city),
    ["podgorica", "podgorica"],
  );
});

test("parses Budva events with the correct city assignment and preserves date-only records", async () => {
  const html = await readFile(budvaFixturePath, "utf8");
  const parsed = parseMonteGigsEvents(html, budva, new Date("2026-07-22T10:00:00.000Z"));

  assert.equal(parsed.recognized, true);
  assert.equal(parsed.records, 2);
  assert.deepEqual(
    parsed.events.map(({ city, startDate, startsAt, title }) => ({
      city,
      startDate,
      startsAt,
      title,
    })),
    [
      {
        city: "budva",
        startDate: "2026-08-12",
        startsAt: "2026-08-12T18:00:00.000Z",
        title: "Budva Sunset Session",
      },
      {
        city: "budva",
        startDate: "2026-08-13",
        startsAt: undefined,
        title: "Acoustic on the Coast",
      },
    ],
  );
});

test("retains a valid cache when the listing no longer exposes event links", async () => {
  const cachePath = join(await mkdtemp(join(tmpdir(), "gradom-going-out-")), "going-out.json");
  const validHtml = await readFile(podgoricaFixturePath, "utf8");
  const first = await refreshMonteGigsGoingOut({
    cachePath,
    context: podgorica,
    httpClient: { get: async () => response(validHtml) },
    now: new Date("2026-07-22T10:00:00.000Z"),
  });
  const retained = await refreshMonteGigsGoingOut({
    cachePath,
    context: podgorica,
    httpClient: { get: async () => response("<html><main><p>Maintenance</p></main></html>") },
    now: new Date("2026-07-22T11:00:00.000Z"),
  });

  assert.equal(first.success, true);
  assert.equal(retained.success, false);
  assert.equal(retained.retainedPreviousSnapshot, true);
  assert.equal(retained.snapshot?.events.length, 2);
});

test("accepts and round-trips a Tivat cache snapshot through the widened city schema", async () => {
  // Regression test for widening goingOutEventSchema/goingOutCacheSnapshotSchema's city enum:
  // before that change, a cached Tivat snapshot (or a Tivat event within any snapshot) would
  // fail Zod validation and silently read back as unavailable, even with a correctly configured
  // MonteGigs source and a successful live fetch.
  const cachePath = join(
    await mkdtemp(join(tmpdir(), "gradom-going-out-tivat-cache-")),
    "going-out.json",
  );
  await writeFile(
    cachePath,
    JSON.stringify({
      cityId: "tivat",
      events: [
        {
          city: "tivat",
          id: "tivat-1-20991231-party",
          sourceName: "MonteGigs",
          sourceUrl: "https://staging.montegigs.me/me/events/tivat/1-20991231-party",
          startDate: "2099-12-31",
          title: "Tivat party",
        },
      ],
      fetchedAt: "2026-07-22T10:00:00.000Z",
      lastSuccessfulRefreshAt: "2026-07-22T10:00:00.000Z",
      parserWarnings: [],
      schemaVersion: 1,
      sourceUrl: "https://staging.montegigs.me/me/events/tivat",
    }),
    "utf8",
  );

  const snapshot = await readGoingOutCacheSnapshot(cachePath, "tivat");
  assert.notEqual(snapshot, null);
  assert.equal(snapshot?.cityId, "tivat");
  assert.equal(snapshot?.events[0]?.city, "tivat");

  const cached = await getCachedMonteGigsGoingOut({
    cachePath,
    context: tivat,
    now: new Date("2026-07-22T10:30:00.000Z"),
  });
  assert.equal(cached.state, "fresh");
  assert.equal(cached.events.length, 1);
});

test("reads the atomically written cache without a live request", async () => {
  const cachePath = join(
    await mkdtemp(join(tmpdir(), "gradom-going-out-cache-")),
    "going-out.json",
  );
  const html = await readFile(podgoricaFixturePath, "utf8");
  await refreshMonteGigsGoingOut({
    cachePath,
    context: podgorica,
    httpClient: { get: async () => response(html) },
    now: new Date("2026-07-22T10:00:00.000Z"),
  });

  const cached = await getCachedMonteGigsGoingOut({
    cachePath,
    context: podgorica,
    now: new Date("2026-07-22T14:01:00.000Z"),
  });
  assert.equal(cached.state, "stale");
  assert.equal(cached.events.length, 2);
});

test("allows only the configured MonteGigs listing host", () => {
  assert.doesNotThrow(() => assertMonteGigsUrl("https://staging.montegigs.me/me/events/podgorica"));
  assert.throws(() => assertMonteGigsUrl("https://example.test/me/events/podgorica"));
});

test("uses explicit city sources and independent city cache paths", () => {
  assert.equal(
    getMonteGigsCitySource("podgorica")?.listingUrl,
    "https://staging.montegigs.me/me/events/podgorica",
  );
  assert.equal(
    getMonteGigsCitySource("budva")?.listingUrl,
    "https://staging.montegigs.me/me/events/budva",
  );
  assert.equal(
    getMonteGigsCitySource("tivat")?.listingUrl,
    "https://staging.montegigs.me/me/events/tivat",
  );
  assert.equal(getMonteGigsCitySource("bar"), undefined);
  assert.notEqual(getGoingOutCachePath("podgorica"), getGoingOutCachePath("budva"));
  assert.notEqual(getGoingOutCachePath("podgorica"), getGoingOutCachePath("tivat"));
  assert.notEqual(getGoingOutCachePath("budva"), getGoingOutCachePath("tivat"));
});

test("keeps Budva and Podgorica snapshots isolated through independent retention and freshness", async () => {
  const directory = await mkdtemp(join(tmpdir(), "gradom-going-out-cities-"));
  const podgoricaCachePath = join(directory, "podgorica.json");
  const budvaCachePath = join(directory, "budva.json");
  const podgoricaHtml = await readFile(podgoricaFixturePath, "utf8");
  const budvaHtml = await readFile(budvaFixturePath, "utf8");

  await refreshMonteGigsGoingOut({
    cachePath: podgoricaCachePath,
    context: podgorica,
    httpClient: { get: async () => response(podgoricaHtml) },
    now: new Date("2026-07-22T10:00:00.000Z"),
  });
  await refreshMonteGigsGoingOut({
    cachePath: budvaCachePath,
    context: budva,
    httpClient: { get: async () => response(budvaHtml, "budva") },
    now: new Date("2026-07-22T12:00:00.000Z"),
  });

  const retainedPodgorica = await refreshMonteGigsGoingOut({
    cachePath: podgoricaCachePath,
    context: podgorica,
    httpClient: { get: async () => response("<html><main>Maintenance</main></html>") },
    now: new Date("2026-07-22T13:00:00.000Z"),
  });
  const cachedBudva = await getCachedMonteGigsGoingOut({
    cachePath: budvaCachePath,
    context: budva,
    now: new Date("2026-07-22T13:00:00.000Z"),
  });
  const cachedPodgorica = await getCachedMonteGigsGoingOut({
    cachePath: podgoricaCachePath,
    context: podgorica,
    now: new Date("2026-07-22T15:00:00.000Z"),
  });

  assert.equal(retainedPodgorica.retainedPreviousSnapshot, true);
  assert.deepEqual(
    cachedBudva.events.map((event) => event.city),
    ["budva", "budva"],
  );
  assert.equal(cachedBudva.state, "fresh");
  assert.equal(cachedPodgorica.state, "stale");
});

test("rejects unsupported city contexts without reading or writing a snapshot", async () => {
  const unsupported = { ...budva, city: { ...budva.city, id: "bar", slug: "bar" } };
  const result = await refreshMonteGigsGoingOut({ context: unsupported });

  assert.equal(result.success, false);
  assert.equal(result.errorCode, "montegigs-city-unsupported");
  assert.equal(result.snapshot, null);
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

function response(body: string, city: "budva" | "podgorica" | "tivat" = "podgorica") {
  return {
    body,
    contentType: "text/html",
    finalUrl: `https://staging.montegigs.me/me/events/${city}`,
    requestedUrl: `https://staging.montegigs.me/me/events/${city}`,
    status: 200,
  };
}
