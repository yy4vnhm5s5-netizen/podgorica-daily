import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { tmpdir } from "node:os";

import {
  assertMonteGigsDetailUrl,
  assertMonteGigsListingUrl,
  assertMonteGigsUrl,
  createMonteGigsHttpClient,
  getCachedMonteGigsGoingOut,
  getGoingOutCachePath,
  getGoingOutDetailCachePath,
  getMonteGigsCitySource,
  monteGigsCitySources,
  parseMonteGigsEvents,
  readMonteGigsDetailCache,
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
    "https://montegigs.me/me/events/bar/6453-20260807-ljeto-sa-zvijezdama-savo-perovic-sladja-allegro",
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
  assert.equal(parsed.events[0]?.imageUrl, "https://montegigs.me/media/events/summer-jam.jpg");
  assert.deepEqual(
    parsed.events.map((event) => event.city),
    ["podgorica", "podgorica"],
  );
});

test("canonicalizes only first-party MonteGigs event image assets from the listing", () => {
  const parseImage = (imageSrc: string) =>
    parseMonteGigsEvents(
      `<main><article><a href="/me/events/podgorica/8021-20260812-kiteloop-week-hulahoop"><img src="${imageSrc}" /><h3>KiteLoop Week: HulaHoop</h3></a><p>12. avg • Kiteloop</p></article></main>`,
      podgorica,
      new Date("2026-08-01T10:00:00.000Z"),
    ).events[0]?.imageUrl;

  assert.equal(
    parseImage("/media/events/8021.jpg?width=400&quality=85&fit=scale-down&format=auto"),
    "https://montegigs.me/media/events/8021.jpg?width=400&quality=85&fit=scale-down&format=auto",
  );
  assert.equal(
    parseImage("https://staging.montegigs.me/media/events/8021.jpg?width=400&quality=85"),
    "https://montegigs.me/media/events/8021.jpg?width=400&quality=85",
  );
  assert.equal(
    parseImage("https://montegigs.me/media/events/8021.jpg?width=400&quality=85"),
    "https://montegigs.me/media/events/8021.jpg?width=400&quality=85",
  );
  assert.equal(parseImage("https://instagram.com/p/event-image"), undefined);
  assert.equal(parseImage("https://facebook.com/event-image"), undefined);
  assert.equal(parseImage("https://montegigs.me/images/8021.jpg"), undefined);
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
  assert.equal(parsed.events[0]?.imageUrl, "https://montegigs.me/media/events/kotor-sunset.jpg");
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
        imageUrl: "https://montegigs.me/media/events/kotor-concert.jpg",
        sourceUrl: "https://montegigs.me/me/events/kotor/7465-20260812-koncert-u-kotoru",
        startsAt: "2026-08-12T18:30:00.000Z",
        title: "Koncert u Kotoru",
        venue: "Pjaca od kina",
      },
      {
        imageUrl: "https://montegigs.me/media/events/kotor-evening.jpg",
        sourceUrl: "https://montegigs.me/me/events/kotor/7467-20260813-vecernji-program",
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

test("keeps a legacy Tivat cache snapshot publicly readable through the widened city schema", async () => {
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
  assert.equal(
    snapshot?.events[0]?.sourceUrl,
    "https://staging.montegigs.me/me/events/tivat/1-20991231-party",
  );

  const cached = await getCachedMonteGigsGoingOut({
    cachePath,
    context: tivat,
    now: new Date("2026-07-22T10:30:00.000Z"),
  });
  assert.equal(cached.state, "fresh");
  assert.equal(cached.events.length, 1);
  assert.equal(
    cached.events[0]?.sourceUrl,
    "https://staging.montegigs.me/me/events/tivat/1-20991231-party",
  );
});

test("reuses a legacy detail cache entry for a canonical listing and rewrites its source URL", async () => {
  const directory = await mkdtemp(join(tmpdir(), "gradom-going-out-legacy-detail-cache-"));
  const cachePath = join(directory, "budva.json");
  const detailCachePath = join(directory, "budva-details.json");
  const sourceEventId = "9600";
  const entry = createDetailCacheEntry(sourceEventId, "2026-08-01T09:00:00.000Z");
  await writeFile(
    detailCachePath,
    JSON.stringify({
      cityId: "budva",
      entries: [
        {
          ...entry,
          sourceUrl: entry.sourceUrl.replace(
            "https://montegigs.me",
            "https://staging.montegigs.me",
          ),
        },
      ],
      schemaVersion: 1,
      updatedAt: "2026-08-01T09:00:00.000Z",
    }),
    "utf8",
  );
  const requestedDetailUrls: string[] = [];

  const refreshed = await refreshMonteGigsGoingOut({
    cachePath,
    context: budva,
    detailCachePath,
    httpClient: {
      get: async (url) => {
        if (url.endsWith("/me/events/budva")) {
          return response(
            createMonteGigsListing([{ id: sourceEventId, title: "Budva event" }]),
            "budva",
          );
        }
        requestedDetailUrls.push(url);
        throw new Error("a fresh legacy cache entry should be reused");
      },
    },
    now: new Date("2026-08-01T10:00:00.000Z"),
  });

  assert.equal(refreshed.success, true);
  assert.equal(refreshed.snapshot?.events[0]?.description, `Opis ${sourceEventId}`);
  assert.deepEqual(requestedDetailUrls, []);
  assert.equal(
    (await readMonteGigsDetailCache(detailCachePath, "budva")).entries.get(sourceEventId)
      ?.sourceUrl,
    `https://montegigs.me/me/events/budva/${sourceEventId}-20260802-event-${sourceEventId}`,
  );
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
  assert.equal(
    eventsBySourceEventId.get("7497")?.imageUrl,
    "https://montegigs.me/media/events/7925.jpg",
  );
  assert.equal(eventsBySourceEventId.get("7497")?.priceLabel, "30-40");
  assert.equal(eventsBySourceEventId.get("7906")?.isFree, true);
  assert.equal(eventsBySourceEventId.get("7906")?.priceLabel, undefined);

  const cached = await getCachedMonteGigsGoingOut({
    cachePath,
    context: budva,
    now: new Date("2026-08-01T10:01:00.000Z"),
  });
  assert.equal(
    cached.events.find((event) => event.sourceEventId === "7497")?.imageUrl,
    "https://montegigs.me/media/events/7925.jpg",
  );
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
    "https://montegigs.me/me/events/kotor",
    "https://montegigs.me/me/events/kotor/7465-20260812-koncert-u-kotoru",
    "https://montegigs.me/me/events/kotor/7467-20260813-vecernji-program",
  ]);
  assert.equal(
    requestedUrls.some((url) => url.includes("kotorart.me")),
    false,
  );
  assert.equal(refreshed.snapshot?.events.length, 2);
  assert.deepEqual(
    refreshed.snapshot?.events.find((event) => event.sourceEventId === "7465"),
    {
      address: "Trg od kina, Kotor",
      city: "kotor",
      description: "Koncert na otvorenom uz lokalne izvođače i goste večeri.",
      id: "https://montegigs.me/me/events/kotor/7465-20260812-koncert-u-kotoru|2026-08-12|20:30|koncert u kotoru",
      imageUrl: "https://montegigs.me/media/events/kotor-concert.jpg",
      informationUrl: "https://kotorart.me/program/koncert-u-kotoru",
      organizer: "KotorArt",
      sourceName: "MonteGigs",
      sourceEventId: "7465",
      sourceUrl: "https://montegigs.me/me/events/kotor/7465-20260812-koncert-u-kotoru",
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
    detailCacheHits: 0,
    detailCacheMisses: 2,
    detailCacheStale: 0,
    detailCacheStaleFallbacks: 0,
    detailCacheWriteFailures: 0,
    detailEnrichedEvents: 1,
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
    candidateEvents: 14,
    descriptionCount: 0,
    detailCacheHits: 0,
    detailCacheMisses: 14,
    detailCacheStale: 0,
    detailCacheStaleFallbacks: 0,
    detailCacheWriteFailures: 0,
    detailEnrichedEvents: 0,
    detailFetchAttempted: 12,
    detailFetchSucceeded: 12,
    informationUrlCount: 0,
    organizerCount: 0,
  });
});

test("progressively fills a cold detail cache and makes no detail requests once all upcoming events are warm", async () => {
  const directory = await mkdtemp(join(tmpdir(), "gradom-going-out-detail-progressive-"));
  const cachePath = join(directory, "budva.json");
  const detailCachePath = join(directory, "budva-details.json");
  const listing = createMonteGigsListing(
    Array.from({ length: 34 }, (_, index) => ({
      id: String(9_000 + index),
      title: `Event ${index + 1}`,
    })),
  );
  const requestedDetails: string[] = [];
  const client = {
    get: async (url: string) => {
      if (url.endsWith("/me/events/budva")) return response(listing, "budva");
      requestedDetails.push(url);
      return detailResponse(createMonteGigsDetail(url), url);
    },
  };
  const firstRefreshAt = new Date("2026-08-01T10:00:00.000Z");

  const first = await refreshMonteGigsGoingOut({
    cachePath,
    context: budva,
    detailCachePath,
    httpClient: client,
    now: firstRefreshAt,
  });
  const second = await refreshMonteGigsGoingOut({
    cachePath,
    context: budva,
    detailCachePath,
    httpClient: client,
    now: new Date("2026-08-01T13:00:00.000Z"),
  });
  const third = await refreshMonteGigsGoingOut({
    cachePath,
    context: budva,
    detailCachePath,
    httpClient: client,
    now: new Date("2026-08-01T16:00:00.000Z"),
  });
  const requestsAfterThreeRefreshes = requestedDetails.length;
  const warm = await refreshMonteGigsGoingOut({
    cachePath,
    context: budva,
    detailCachePath,
    httpClient: client,
    now: new Date("2026-08-01T19:00:00.000Z"),
  });
  const staleBudgeted = await refreshMonteGigsGoingOut({
    cachePath,
    context: budva,
    detailCachePath,
    httpClient: client,
    now: new Date("2026-08-02T17:00:00.000Z"),
  });

  assert.equal(requestedDetails.length, 46);
  assert.equal(requestsAfterThreeRefreshes, 34);
  assert.deepEqual(
    [first, second, third].map(({ detailCoverage }) => ({
      detailCacheHits: detailCoverage?.detailCacheHits,
      detailCacheMisses: detailCoverage?.detailCacheMisses,
      detailFetchAttempted: detailCoverage?.detailFetchAttempted,
      detailEnrichedEvents: detailCoverage?.detailEnrichedEvents,
    })),
    [
      {
        detailCacheHits: 0,
        detailCacheMisses: 34,
        detailFetchAttempted: 12,
        detailEnrichedEvents: 12,
      },
      {
        detailCacheHits: 12,
        detailCacheMisses: 22,
        detailFetchAttempted: 12,
        detailEnrichedEvents: 24,
      },
      {
        detailCacheHits: 24,
        detailCacheMisses: 10,
        detailFetchAttempted: 10,
        detailEnrichedEvents: 34,
      },
    ],
  );
  assert.equal(warm.detailCoverage?.detailCacheHits, 34);
  assert.equal(warm.detailCoverage?.detailFetchAttempted, 0);
  assert.equal(staleBudgeted.detailCoverage?.detailCacheStale, 34);
  assert.equal(staleBudgeted.detailCoverage?.detailFetchAttempted, 12);
  assert.equal(staleBudgeted.detailCoverage?.detailCacheStaleFallbacks, 22);
  assert.equal(staleBudgeted.detailCoverage?.detailEnrichedEvents, 34);
  assert.equal(
    warm.snapshot?.events.every((event) => Boolean(event.description)),
    true,
  );
  assert.equal((await readMonteGigsDetailCache(detailCachePath, "budva")).entries.size, 34);
});

test("reuses source-event keyed details while keeping the current listing authoritative", async () => {
  const directory = await mkdtemp(join(tmpdir(), "gradom-going-out-detail-source-id-"));
  const cachePath = join(directory, "budva.json");
  const detailCachePath = join(directory, "budva-details.json");
  const initialListing = createMonteGigsListing([
    { id: "9300", title: "Original title" },
    { id: "9301", title: "Existing event" },
  ]);
  const changedListing = createMonteGigsListing([
    { id: "9300", title: "Updated listing title" },
    { id: "9301", title: "Existing event" },
    { id: "9302", title: "New event" },
  ]);
  const replacementIdListing = createMonteGigsListing([
    { id: "9303", title: "Replacement source event" },
    { id: "9301", title: "Existing event" },
    { id: "9302", title: "New event" },
  ]);
  const requestedDetails: string[] = [];
  let listing = initialListing;
  const client = {
    get: async (url: string) => {
      if (url.endsWith("/me/events/budva")) return response(listing, "budva");
      requestedDetails.push(url);
      return detailResponse(createMonteGigsDetail(url), url);
    },
  };

  await refreshMonteGigsGoingOut({
    cachePath,
    context: budva,
    detailCachePath,
    httpClient: client,
    now: new Date("2026-08-01T10:00:00.000Z"),
  });
  requestedDetails.length = 0;
  listing = changedListing;
  const changedTitle = await refreshMonteGigsGoingOut({
    cachePath,
    context: budva,
    detailCachePath,
    httpClient: client,
    now: new Date("2026-08-01T13:00:00.000Z"),
  });

  assert.deepEqual(requestedDetails.map(monteGigsSourceIdFromUrl), ["9302"]);
  assert.equal(
    changedTitle.snapshot?.events.find((event) => event.sourceEventId === "9300")?.title,
    "Updated listing title",
  );
  assert.equal(
    changedTitle.snapshot?.events.find((event) => event.sourceEventId === "9300")?.description,
    "Opis 9300",
  );
  assert.equal(changedTitle.detailCoverage?.detailCacheHits, 2);
  assert.equal(changedTitle.detailCoverage?.detailCacheMisses, 1);

  requestedDetails.length = 0;
  listing = replacementIdListing;
  await refreshMonteGigsGoingOut({
    cachePath,
    context: budva,
    detailCachePath,
    httpClient: client,
    now: new Date("2026-08-01T16:00:00.000Z"),
  });
  assert.deepEqual(requestedDetails.map(monteGigsSourceIdFromUrl), ["9303"]);
});

test("fetches a repeated source event only once per refresh", async () => {
  const directory = await mkdtemp(join(tmpdir(), "gradom-going-out-detail-duplicate-"));
  const cachePath = join(directory, "budva.json");
  const detailCachePath = join(directory, "budva-details.json");
  const sourceUrl = "/me/events/budva/9350-20260820-shared-event";
  const listing = `<main><article><a href="${sourceUrl}"><h3>Shared event A</h3></a><p>20. avg • Budva</p></article><article><a href="${sourceUrl}"><h3>Shared event B</h3></a><p>20. avg • Budva</p></article></main>`;
  let detailRequests = 0;

  const refreshed = await refreshMonteGigsGoingOut({
    cachePath,
    context: budva,
    detailCachePath,
    httpClient: {
      get: async (url) => {
        if (url.endsWith("/me/events/budva")) return response(listing, "budva");
        detailRequests += 1;
        return detailResponse(createMonteGigsDetail(url), url);
      },
    },
    now: new Date("2026-08-01T10:00:00.000Z"),
  });

  assert.equal(detailRequests, 1);
  assert.equal(refreshed.detailCoverage?.candidateEvents, 1);
  assert.equal(refreshed.snapshot?.events.length, 2);
});

test("does not reuse a detail cache entry from a different MonteGigs city path", async () => {
  const directory = await mkdtemp(join(tmpdir(), "gradom-going-out-detail-source-scope-"));
  const cachePath = join(directory, "budva.json");
  const detailCachePath = join(directory, "budva-details.json");
  const sourceEventId = "9360";
  await writeFile(
    detailCachePath,
    JSON.stringify({
      cityId: "budva",
      entries: [
        {
          ...createDetailCacheEntry(sourceEventId, "2026-08-01T09:00:00.000Z"),
          description: "Wrong city detail",
          sourceUrl: `https://montegigs.me/me/events/kotor/${sourceEventId}-20260820-event-${sourceEventId}`,
        },
      ],
      schemaVersion: 1,
      updatedAt: "2026-08-01T09:00:00.000Z",
    }),
    "utf8",
  );
  let detailRequests = 0;
  const refreshed = await refreshMonteGigsGoingOut({
    cachePath,
    context: budva,
    detailCachePath,
    httpClient: {
      get: async (url) => {
        if (url.endsWith("/me/events/budva")) {
          return response(
            createMonteGigsListing([{ id: sourceEventId, title: "Budva event" }]),
            "budva",
          );
        }
        detailRequests += 1;
        return detailResponse(createMonteGigsDetail(url), url);
      },
    },
    now: new Date("2026-08-01T10:00:00.000Z"),
  });

  assert.equal(detailRequests, 1);
  assert.equal(refreshed.detailCoverage?.detailCacheMisses, 1);
  assert.equal(refreshed.snapshot?.events[0]?.description, "Opis 9360");
});

test("revalidates stale entries, uses a bounded stale fallback on failure, and fails open after it expires", async () => {
  const directory = await mkdtemp(join(tmpdir(), "gradom-going-out-detail-stale-"));
  const cachePath = join(directory, "budva.json");
  const detailCachePath = join(directory, "budva-details.json");
  const listing = createMonteGigsListing([{ id: "9400", title: "Stale event" }]);
  let failDetails = false;
  const client = {
    get: async (url: string) => {
      if (url.endsWith("/me/events/budva")) return response(listing, "budva");
      if (failDetails) throw new Error("detail unavailable");
      return detailResponse(createMonteGigsDetail(url), url);
    },
  };

  await refreshMonteGigsGoingOut({
    cachePath,
    context: budva,
    detailCachePath,
    httpClient: client,
    now: new Date("2026-08-01T10:00:00.000Z"),
  });
  failDetails = true;
  const staleFallback = await refreshMonteGigsGoingOut({
    cachePath,
    context: budva,
    detailCachePath,
    httpClient: client,
    now: new Date("2026-08-01T23:00:00.000Z"),
  });
  const expiredFallback = await refreshMonteGigsGoingOut({
    cachePath,
    context: budva,
    detailCachePath,
    httpClient: client,
    now: new Date("2026-08-04T12:00:00.000Z"),
  });

  assert.equal(staleFallback.snapshot?.events[0]?.description, "Opis 9400");
  assert.equal(staleFallback.detailCoverage?.detailCacheStale, 1);
  assert.equal(staleFallback.detailCoverage?.detailCacheStaleFallbacks, 1);
  assert.ok(staleFallback.warnings.includes("montegigs-detail-enrichment-incomplete"));
  assert.equal(expiredFallback.snapshot?.events[0]?.description, undefined);
  assert.equal(expiredFallback.detailCoverage?.detailCacheStaleFallbacks, 0);
});

test("tolerates malformed detail cache entries, isolates cache-write failures, and cleans only expired missing entries", async () => {
  const directory = await mkdtemp(join(tmpdir(), "gradom-going-out-detail-cache-failure-"));
  const cachePath = join(directory, "budva.json");
  const detailCachePath = join(directory, "budva-details.json");
  const listing = createMonteGigsListing([{ id: "9500", title: "Current event" }]);
  let detailRequests = 0;
  const client = {
    get: async (url: string) => {
      if (url.endsWith("/me/events/budva")) return response(listing, "budva");
      detailRequests += 1;
      return detailResponse(createMonteGigsDetail(url), url);
    },
  };
  await writeFile(detailCachePath, "{not-json", "utf8");

  const malformedCache = await refreshMonteGigsGoingOut({
    cachePath,
    context: budva,
    detailCachePath,
    httpClient: client,
    now: new Date("2026-08-01T10:00:00.000Z"),
  });
  assert.equal(malformedCache.success, true);
  assert.equal(malformedCache.snapshot?.events[0]?.description, "Opis 9500");

  const recentMissingEntry = createDetailCacheEntry("9501", "2026-07-28T10:00:00.000Z");
  const expiredMissingEntry = createDetailCacheEntry("9502", "2026-07-10T10:00:00.000Z");
  await writeFile(
    detailCachePath,
    JSON.stringify({
      cityId: "budva",
      entries: [
        ...(await readMonteGigsDetailCache(detailCachePath, "budva")).entries.values(),
        recentMissingEntry,
        expiredMissingEntry,
        { sourceEventId: "broken" },
      ],
      schemaVersion: 1,
      updatedAt: "2026-08-01T10:00:00.000Z",
    }),
    "utf8",
  );
  await refreshMonteGigsGoingOut({
    cachePath,
    context: budva,
    detailCachePath,
    httpClient: client,
    now: new Date("2026-08-01T11:00:00.000Z"),
  });
  assert.equal(detailRequests, 1);
  const cleaned = await readMonteGigsDetailCache(detailCachePath, "budva");
  assert.equal(cleaned.entries.has("9501"), true);
  assert.equal(cleaned.entries.has("9502"), false);

  const blockedDirectory = join(directory, "blocked");
  await writeFile(blockedDirectory, "not-a-directory", "utf8");
  const detailCacheWriteFailure = await refreshMonteGigsGoingOut({
    cachePath,
    context: budva,
    detailCachePath: join(blockedDirectory, "details.json"),
    httpClient: client,
    now: new Date("2026-08-01T12:00:00.000Z"),
  });
  assert.equal(detailCacheWriteFailure.success, true);
  assert.equal(detailCacheWriteFailure.detailCoverage?.detailCacheWriteFailures, 1);
  assert.ok(detailCacheWriteFailure.warnings.includes("montegigs-detail-cache-write-failed"));
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
              "https://montegigs.me/me/events/kotor/9999-20260812-other-event",
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

test("accepts canonical production and legacy cached MonteGigs URLs, but rejects external hosts", () => {
  assert.doesNotThrow(() => assertMonteGigsUrl("https://montegigs.me/me/events/podgorica"));
  assert.doesNotThrow(() =>
    assertMonteGigsListingUrl("https://montegigs.me/me/events/podgorica", "podgorica"),
  );
  assert.doesNotThrow(() => assertMonteGigsUrl("https://staging.montegigs.me/me/events/podgorica"));
  assert.doesNotThrow(() =>
    assertMonteGigsDetailUrl(
      "https://montegigs.me/me/events/podgorica/8021-20260812-kiteloop-week-hulahoop",
      "https://montegigs.me/me/events/podgorica/8021-20260812-kiteloop-week-hulahoop",
    ),
  );
  assert.throws(() => assertMonteGigsUrl("https://example.test/me/events/podgorica"));
});

test("uses explicit city sources and independent city cache paths", () => {
  assert.deepEqual(
    Object.values(monteGigsCitySources).map(({ listingUrl }) => listingUrl),
    [
      "https://montegigs.me/me/events/bar",
      "https://montegigs.me/me/events/budva",
      "https://montegigs.me/me/events/kotor",
      "https://montegigs.me/me/events/podgorica",
      "https://montegigs.me/me/events/tivat",
      "https://montegigs.me/me/events/ulcinj",
    ],
  );
  assert.equal(getMonteGigsCitySource("bar")?.listingUrl, "https://montegigs.me/me/events/bar");
  assert.equal(
    getMonteGigsCitySource("podgorica")?.listingUrl,
    "https://montegigs.me/me/events/podgorica",
  );
  assert.equal(getMonteGigsCitySource("budva")?.listingUrl, "https://montegigs.me/me/events/budva");
  assert.equal(getMonteGigsCitySource("tivat")?.listingUrl, "https://montegigs.me/me/events/tivat");
  assert.equal(getMonteGigsCitySource("kotor")?.listingUrl, "https://montegigs.me/me/events/kotor");
  assert.notEqual(getGoingOutCachePath("bar"), getGoingOutCachePath("podgorica"));
  assert.notEqual(getGoingOutCachePath("bar"), getGoingOutCachePath("budva"));
  assert.notEqual(getGoingOutCachePath("podgorica"), getGoingOutCachePath("budva"));
  assert.notEqual(getGoingOutCachePath("podgorica"), getGoingOutCachePath("tivat"));
  assert.notEqual(getGoingOutCachePath("budva"), getGoingOutCachePath("tivat"));
  assert.notEqual(getGoingOutCachePath("kotor"), getGoingOutCachePath("budva"));
  assert.notEqual(getGoingOutDetailCachePath("podgorica"), getGoingOutDetailCachePath("budva"));
  assert.notEqual(getGoingOutDetailCachePath("budva"), getGoingOutDetailCachePath("kotor"));
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
            url: "https://montegigs.me/me/events/podgorica",
          }
        : {
            headers: { get: () => "text/html" },
            ok: true,
            status: 200,
            text: async () => "<html></html>",
            url: "https://montegigs.me/me/events/podgorica",
          };
    },
  });

  const value = await client.get("https://montegigs.me/me/events/podgorica");
  assert.equal(calls, 2);
  assert.equal(value.status, 200);
});

function createMonteGigsListing(events: readonly { id: string; title: string }[]) {
  return `<main>${events
    .map(({ id, title }, index) => {
      const date = new Date(Date.UTC(2026, 7, index + 2));
      const compactDate = date.toISOString().slice(0, 10).replaceAll("-", "");
      return `<article><a href="/me/events/budva/${id}-${compactDate}-event-${id}"><h3>${title}</h3></a><p>${date.getUTCDate()}. avg • Budva</p></article>`;
    })
    .join("")}</main>`;
}

function createMonteGigsDetail(sourceUrl: string) {
  return `<main><h2>Opis</h2><p>Opis ${monteGigsSourceIdFromUrl(sourceUrl)}</p></main>`;
}

function monteGigsSourceIdFromUrl(sourceUrl: string) {
  return /\/events\/budva\/(\d+)-/u.exec(sourceUrl)?.[1] ?? "unknown";
}

function createDetailCacheEntry(sourceEventId: string, fetchedAt: string) {
  return {
    description: `Opis ${sourceEventId}`,
    fetchedAt,
    lastSeenAt: fetchedAt,
    sourceEventId,
    sourceUrl: `https://montegigs.me/me/events/budva/${sourceEventId}-20260820-event-${sourceEventId}`,
  };
}

function response(
  body: string,
  city: "bar" | "budva" | "kotor" | "podgorica" | "tivat" = "podgorica",
) {
  return {
    body,
    contentType: "text/html",
    finalUrl: `https://montegigs.me/me/events/${city}`,
    requestedUrl: `https://montegigs.me/me/events/${city}`,
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
