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
  readGoingOutCacheSnapshot,
  refreshMonteGigsGoingOut,
} from "./montegigs-going-out.ts";
import { createCityContext } from "@/shared/config/cities";

const podgoricaFixturePath = join(
  import.meta.dirname,
  "__fixtures__",
  "montegigs-podgorica-listing.html",
);
const budvaFixturePath = join(import.meta.dirname, "__fixtures__", "montegigs-budva-listing.html");
const budvaPayloadEnrichmentFixturePath = join(
  import.meta.dirname,
  "__fixtures__",
  "montegigs-budva-payload-enrichment.html",
);
const kotorFixturePath = join(import.meta.dirname, "__fixtures__", "montegigs-kotor-listing.html");
const barFixturePath = join(import.meta.dirname, "__fixtures__", "montegigs-bar-listing.html");
const kotorBoundariesFixturePath = join(
  import.meta.dirname,
  "__fixtures__",
  "montegigs-kotor-event-boundaries.html",
);
const kotorDetailFixturePath = join(
  import.meta.dirname,
  "__fixtures__",
  "montegigs-kotor-detail-jsonld.html",
);
const podgorica = createCityContext("podgorica");
const budva = createCityContext("budva");
const tivat = createCityContext("tivat");
const kotor = createCityContext("kotor");
const bar = createCityContext("bar");

test("parses only Bar events from the approved city listing without leaking neighbouring metadata", async () => {
  const parsed = parseMonteGigsEvents(
    await readFile(barFixturePath, "utf8"),
    bar,
    new Date("2026-07-22T10:00:00.000Z"),
  );

  assert.equal(parsed.recognized, true);
  assert.deepEqual(
    parsed.events.map(({ city, startDate, startsAt, title, venue }) => ({
      city,
      startDate,
      startsAt,
      title,
      venue,
    })),
    [
      {
        city: "bar",
        startDate: "2026-08-07",
        startsAt: "2026-08-07T19:00:00.000Z",
        title: "Ljeto sa zvijezdama: Savo Perović & Slađa Allegro",
        venue: "Šetalište Kralja Nikole",
      },
    ],
  );
  assert.equal(
    parsed.events[0]?.sourceUrl,
    "https://staging.montegigs.me/me/events/bar/6453-20260807-ljeto-sa-zvijezdama-savo-perovic-sladja-allegro",
  );
});

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

test("parses Kotor events through the shared city-aware MonteGigs parser", async () => {
  const parsed = parseMonteGigsEvents(
    await readFile(kotorFixturePath, "utf8"),
    kotor,
    new Date("2026-07-22T10:00:00.000Z"),
  );

  assert.equal(parsed.recognized, true);
  assert.deepEqual(
    parsed.events.map(({ city, startDate, title, venue }) => ({ city, startDate, title, venue })),
    [
      {
        city: "kotor",
        startDate: "2026-08-12",
        title: "Kotor Sunset Session",
        venue: "Pjaca od kina",
      },
      { city: "kotor", startDate: "2026-08-13", title: "Evening in Kotor", venue: "Stari grad" },
    ],
  );
  assert.equal(parsed.events[0]?.imageUrl, "https://staging.montegigs.me/images/kotor-sunset.jpg");
});

test("keeps Kotor event metadata within its own card boundaries", async () => {
  const parsed = parseMonteGigsEvents(
    await readFile(kotorBoundariesFixturePath, "utf8"),
    kotor,
    new Date("2026-07-22T10:00:00.000Z"),
  );

  assert.equal(parsed.records, 2);
  assert.deepEqual(
    parsed.events.map(({ imageUrl, sourceUrl, startsAt, title, venue }) => ({
      imageUrl,
      sourceUrl,
      startsAt,
      title,
      venue,
    })),
    [
      {
        imageUrl: "https://staging.montegigs.me/images/kotor-concert.jpg",
        sourceUrl: "https://staging.montegigs.me/me/events/kotor/7465-20260812-koncert-u-kotoru",
        startsAt: "2026-08-12T18:30:00.000Z",
        title: "Koncert u Kotoru",
        venue: "Pjaca od kina",
      },
      {
        imageUrl: "https://staging.montegigs.me/images/kotor-evening.jpg",
        sourceUrl: "https://staging.montegigs.me/me/events/kotor/7467-20260813-vecernji-program",
        startsAt: undefined,
        title: "Večernji program",
        venue: "Stari grad",
      },
    ],
  );
  assert.ok(
    parsed.events.every(
      ({ title, venue = "" }) =>
        !/(?:Andrijevica|Bar|Footer event|Legitiman opis)/iu.test(`${title} ${venue}`),
    ),
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
  assert.equal(snapshot?.events[0]?.sourceEventId, "1");

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

test("round-trips enriched listing fields through the same city snapshot", async () => {
  const cachePath = join(
    await mkdtemp(join(tmpdir(), "gradom-going-out-enrichment-")),
    "budva.json",
  );
  const html = await readFile(budvaPayloadEnrichmentFixturePath, "utf8");

  const refreshed = await refreshMonteGigsGoingOut({
    cachePath,
    context: budva,
    httpClient: { get: async () => response(html, "budva") },
    now: new Date("2026-08-01T10:00:00.000Z"),
  });
  const snapshot = await readGoingOutCacheSnapshot(cachePath, "budva");

  assert.equal(refreshed.success, true);
  assert.equal(snapshot?.events.length, 3);
  const eventsBySourceEventId = new Map(
    snapshot?.events.map((event) => [event.sourceEventId, event]),
  );
  assert.deepEqual(eventsBySourceEventId.get("7497")?.performers, ["Jakov Jozinović"]);
  assert.equal(eventsBySourceEventId.get("7497")?.priceLabel, "30-40");
  assert.equal(eventsBySourceEventId.get("7906")?.isFree, true);
  assert.equal(eventsBySourceEventId.get("7906")?.priceLabel, undefined);
});

test("enriches a listing snapshot from matching detail responses and fails open per event", async () => {
  const requestedUrls: string[] = [];
  const listing = await readFile(kotorBoundariesFixturePath, "utf8");
  const detail = await readFile(kotorDetailFixturePath, "utf8");
  const cachePath = join(await mkdtemp(join(tmpdir(), "gradom-going-out-details-")), "kotor.json");

  const refreshed = await refreshMonteGigsGoingOut({
    cachePath,
    context: kotor,
    httpClient: {
      get: async (url) => {
        requestedUrls.push(url);
        if (url.endsWith("/me/events/kotor")) return response(listing, "kotor");
        if (url.includes("/7465-")) return detailResponse(detail, url);
        throw new Error("detail unavailable");
      },
    },
    now: new Date("2026-08-01T10:00:00.000Z"),
  });

  assert.equal(refreshed.success, true);
  assert.deepEqual(requestedUrls, [
    "https://staging.montegigs.me/me/events/kotor",
    "https://staging.montegigs.me/me/events/kotor/7465-20260812-koncert-u-kotoru",
    "https://staging.montegigs.me/me/events/kotor/7467-20260813-vecernji-program",
  ]);
  assert.equal(refreshed.snapshot?.events.length, 2);
  assert.deepEqual(
    refreshed.snapshot?.events.find((event) => event.sourceEventId === "7465"),
    {
      address: "Trg od kina, Kotor",
      city: "kotor",
      description: "Koncert na otvorenom uz lokalne izvođače i goste večeri.",
      id: "https://staging.montegigs.me/me/events/kotor/7465-20260812-koncert-u-kotoru|2026-08-12|20:30|koncert u kotoru",
      imageUrl: "https://staging.montegigs.me/images/kotor-concert.jpg",
      informationUrl: "https://kotorart.me/program/koncert-u-kotoru",
      organizer: "KotorArt",
      sourceName: "MonteGigs",
      sourceEventId: "7465",
      sourceUrl: "https://staging.montegigs.me/me/events/kotor/7465-20260812-koncert-u-kotoru",
      startDate: "2026-08-12",
      startsAt: "2026-08-12T18:30:00.000Z",
      title: "Koncert u Kotoru",
      venue: "Pjaca od kina",
    },
  );
  assert.equal(
    refreshed.snapshot?.events.find((event) => event.sourceEventId === "7467")?.description,
    undefined,
  );
  assert.deepEqual(refreshed.detailCoverage, {
    addressCount: 1,
    candidateEvents: 2,
    descriptionCount: 1,
    detailFetchAttempted: 2,
    detailFetchSucceeded: 1,
    informationUrlCount: 1,
    organizerCount: 1,
  });
  assert.ok(refreshed.warnings.includes("montegigs-detail-enrichment-incomplete"));
  const snapshot = await readGoingOutCacheSnapshot(cachePath, "kotor");
  assert.equal(
    snapshot?.events.find((event) => event.sourceEventId === "7465")?.informationUrl,
    "https://kotorart.me/program/koncert-u-kotoru",
  );
});

test("deduplicates details and caps concurrent detail work at twelve upcoming event URLs", async () => {
  const listing = Array.from({ length: 14 }, (_, index) => {
    const id = 8_000 + index;
    return `<article><a href="/me/events/budva/${id}-202608${String(index + 1).padStart(2, "0")}-event-${id}"><h3>Event ${id}</h3></a><p>${index + 1}. avg • Budva</p></article>`;
  }).join("\n");
  let activeDetails = 0;
  let maximumActiveDetails = 0;
  const detailUrls: string[] = [];

  const refreshed = await refreshMonteGigsGoingOut({
    cachePath: join(await mkdtemp(join(tmpdir(), "gradom-going-out-cap-")), "budva.json"),
    context: budva,
    httpClient: {
      get: async (url) => {
        if (url.endsWith("/me/events/budva")) return response(`<main>${listing}</main>`, "budva");
        detailUrls.push(url);
        activeDetails += 1;
        maximumActiveDetails = Math.max(maximumActiveDetails, activeDetails);
        await new Promise((resolve) => setTimeout(resolve, 2));
        activeDetails -= 1;
        return detailResponse("<main></main>", url);
      },
    },
    now: new Date("2026-08-01T10:00:00.000Z"),
  });

  assert.equal(refreshed.success, true);
  assert.equal(refreshed.snapshot?.events.length, 14);
  assert.equal(detailUrls.length, 12);
  assert.equal(new Set(detailUrls).size, 12);
  assert.ok(maximumActiveDetails <= 3);
  assert.deepEqual(refreshed.detailCoverage, {
    addressCount: 0,
    candidateEvents: 12,
    descriptionCount: 0,
    detailFetchAttempted: 12,
    detailFetchSucceeded: 12,
    informationUrlCount: 0,
    organizerCount: 0,
  });
});

test("rejects a detail response that redirects to a different source event", async () => {
  const listing = await readFile(kotorBoundariesFixturePath, "utf8");
  const detail = await readFile(kotorDetailFixturePath, "utf8");
  const refreshed = await refreshMonteGigsGoingOut({
    cachePath: join(await mkdtemp(join(tmpdir(), "gradom-going-out-mismatch-")), "kotor.json"),
    context: kotor,
    httpClient: {
      get: async (url) =>
        url.endsWith("/me/events/kotor")
          ? response(listing, "kotor")
          : detailResponse(
              detail,
              "https://staging.montegigs.me/me/events/kotor/9999-20260812-other-event",
            ),
    },
    now: new Date("2026-08-01T10:00:00.000Z"),
  });

  assert.equal(refreshed.success, true);
  assert.equal(
    refreshed.snapshot?.events.every((event) => event.description === undefined),
    true,
  );
  assert.equal(refreshed.detailCoverage?.detailFetchSucceeded, 0);
});

test("allows only the configured MonteGigs listing host", () => {
  assert.doesNotThrow(() => assertMonteGigsUrl("https://staging.montegigs.me/me/events/podgorica"));
  assert.throws(() => assertMonteGigsUrl("https://example.test/me/events/podgorica"));
});

test("uses explicit city sources and independent city cache paths", () => {
  assert.equal(
    getMonteGigsCitySource("bar")?.listingUrl,
    "https://staging.montegigs.me/me/events/bar",
  );
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
  assert.equal(
    getMonteGigsCitySource("kotor")?.listingUrl,
    "https://staging.montegigs.me/me/events/kotor",
  );
  assert.notEqual(getGoingOutCachePath("bar"), getGoingOutCachePath("podgorica"));
  assert.notEqual(getGoingOutCachePath("bar"), getGoingOutCachePath("budva"));
  assert.notEqual(getGoingOutCachePath("podgorica"), getGoingOutCachePath("budva"));
  assert.notEqual(getGoingOutCachePath("podgorica"), getGoingOutCachePath("tivat"));
  assert.notEqual(getGoingOutCachePath("budva"), getGoingOutCachePath("tivat"));
  assert.notEqual(getGoingOutCachePath("kotor"), getGoingOutCachePath("budva"));
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
  const unsupported = { ...budva, city: { ...budva.city, id: "niksic", slug: "niksic" } };
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

function response(
  body: string,
  city: "bar" | "budva" | "kotor" | "podgorica" | "tivat" = "podgorica",
) {
  return {
    body,
    contentType: "text/html",
    finalUrl: `https://staging.montegigs.me/me/events/${city}`,
    requestedUrl: `https://staging.montegigs.me/me/events/${city}`,
    status: 200,
  };
}

function detailResponse(body: string, url: string) {
  return {
    body,
    contentType: "text/html",
    finalUrl: url,
    requestedUrl: url,
    status: 200,
  };
}
