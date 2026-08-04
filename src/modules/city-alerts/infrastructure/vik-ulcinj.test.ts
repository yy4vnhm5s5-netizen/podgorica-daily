import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import type { CityAlert } from "../domain/city-alert.ts";
import {
  assertVikUlcinjUrl,
  classifyVikUlcinjNotice,
  createVikUlcinjHttpClient,
  extractAffectedLocations,
  getVikUlcinjCityAlerts,
  parseVikUlcinjNotice,
  parseVikUlcinjPosts,
  refreshVikUlcinj,
  vikUlcinjPostsUrl,
  vikUlcinjProviderMetadata,
  VikUlcinjError,
  type VikUlcinjCacheSnapshot,
} from "./vik-ulcinj.ts";
import { createCityContext } from "../../../shared/config/cities.ts";

// Real ViK Ulcinj announcements captured from the site's own WordPress REST API, trimmed to the
// fields the provider reads. Every shape asserted below is one the source actually publishes.
const fixture = async () =>
  readFile(new URL("./__fixtures__/vik-ulcinj-posts.json", import.meta.url), "utf8");

const postById = async (id: number) => {
  const posts = parseVikUlcinjPosts(await fixture());
  const post = posts.find((entry) => entry.sourceId === id);
  assert.ok(post, `fixture must contain post ${id}`);
  return post;
};

const noticeFor = async (id: number, now: Date) => parseVikUlcinjNotice(await postById(id), now);

const duringJuly = new Date("2026-07-12T05:00:00.000Z");

test("reads the WordPress payload the site actually returns", async () => {
  const posts = parseVikUlcinjPosts(await fixture());

  assert.equal(posts.length, 7);
  const post = posts.find((entry) => entry.sourceId === 1140);
  assert.ok(post);
  assert.equal(post.url, "https://vik-ulcinj.me/2026/07/11/obavjestenje-165/");
  assert.equal(post.title, "Obavještenje");
  assert.match(post.content, /Anamalskog/u);
});

test("keeps a planned interruption's stated date and time range", async () => {
  // Published 11.07 at 23:28 for works on 12.07 from 07:00 to 14:00 — the publication day and the
  // service day are deliberately different, which is exactly what must not be conflated.
  const { alerts } = await noticeFor(1140, duringJuly);

  assert.equal(alerts.length, 1);
  const [alert] = alerts;
  assert.equal(alert.type, "waterOutage");
  assert.equal(alert.severity, "warning");
  assert.equal(alert.startsAt?.toISOString(), "2026-07-12T05:00:00.000Z");
  assert.equal(alert.expectedEndAt?.toISOString(), "2026-07-12T12:00:00.000Z");
  assert.equal(alert.publishedAt?.toISOString(), "2026-07-11T23:28:43.000Z");
});

test("never lets the publication timestamp become the service time", async () => {
  const { alerts } = await noticeFor(1140, duringJuly);
  const [alert] = alerts;

  // The publication instant is a different day from the interruption, and neither start nor end
  // may be derived from it.
  assert.notEqual(alert.publishedAt?.toISOString(), alert.startsAt?.toISOString());
  assert.notEqual(alert.publishedAt?.toISOString(), alert.expectedEndAt?.toISOString());
  assert.equal(alert.startsAt && alert.publishedAt && alert.startsAt > alert.publishedAt, true);
});

test("leaves the end missing when the source only says 'do kasnih popodnevnih sati'", async () => {
  // 01.06 announcement: "obustavljeno od 07:00 časova do kasnih popodnevnih sati" — a start exists,
  // the end is prose. Inventing an end here would be a fabricated fact.
  const { alerts } = await noticeFor(1109, new Date("2026-06-02T06:00:00.000Z"));
  const [alert] = alerts;

  assert.equal(alert.startsAt?.toISOString(), "2026-06-02T05:00:00.000Z");
  assert.equal(alert.expectedEndAt, undefined);
  assert.equal(alert.status, "active");
});

test("keeps no service timing at all when the article states none", async () => {
  // Emergency notice: a fault already caused an interruption, no date and no times are given.
  const { alerts } = await noticeFor(1136, new Date("2026-07-07T21:00:00.000Z"));
  const [alert] = alerts;

  assert.equal(alert.type, "waterOutage");
  assert.equal(alert.startsAt, undefined);
  assert.equal(alert.expectedEndAt, undefined);
  assert.ok(alert.publishedAt);
});

test("lists the affected zones exactly as published", async () => {
  const { alerts } = await noticeFor(1136, new Date("2026-07-07T21:00:00.000Z"));

  assert.equal(
    alerts[0].affectedArea.kind === "source" ? alerts[0].affectedArea.value : undefined,
    "Gač, Zoganje, Pistula, Kolomza, Kodra, Dio Ulcinjskog Polja",
  );
});

test("falls back to the municipality rather than inventing an area", async () => {
  const { alerts } = await noticeFor(1109, new Date("2026-06-02T06:00:00.000Z"));

  assert.equal(
    alerts[0].affectedArea.kind === "source" ? alerts[0].affectedArea.value : undefined,
    "Opština Ulcinj",
  );
});

test("collapses only repeated spellings of one place, never distinct places", () => {
  assert.deepEqual(extractAffectedLocations(["📍Gač", "📍GAC", "📍 gač ", "📍Zoganje"]), [
    "Gač",
    "Zoganje",
  ]);
  assert.deepEqual(extractAffectedLocations(["📍Liman I", "📍Liman II"]), ["Liman I", "Liman II"]);
});

test("reads zones listed under a heading with no pin bullets", () => {
  assert.deepEqual(
    extractAffectedLocations([
      "Zbog radova doći će do prekida vodosnabdijevanja u sljedećim naseljima:",
      "Gač",
      "Zoganje",
      "Hvala na razumjevanju,",
      "Doo Vodovod i Kanalizacija-Ulcinj",
    ]),
    ["Gač", "Zoganje"],
  );
});

test("recognises a drinking-water advisory that announces no interruption", async () => {
  const { alerts } = await noticeFor(1142, new Date("2026-07-17T10:00:00.000Z"));

  assert.equal(alerts[0].type, "drinkingWaterNotice");
  assert.equal(alerts[0].severity, "information");
});

test("rejects announcements that are not water-service information", async () => {
  // The July press release about illegal connections discusses "kvalitet i kontinuitet
  // vodosnabdijevanja" at length but announces no interruption, and the holiday notice is about
  // office hours. Neither may become a city alert.
  for (const id of [1179, 1144]) {
    const { alerts, warnings } = await noticeFor(id, duringJuly);
    assert.deepEqual(alerts, [], `post ${id} must not produce an alert`);
    assert.deepEqual(warnings, ["notice-not-water-service-related"]);
  }
});

test("classifies only on stated interruption or drinking-water wording", () => {
  assert.equal(classifyVikUlcinjNotice("doći do prekida vodosnabdijevanja"), "waterOutage");
  assert.equal(classifyVikUlcinjNotice("došlo je do nestanka vode"), "waterOutage");
  assert.equal(classifyVikUlcinjNotice("da vodu ne koriste za piće"), "drinkingWaterNotice");
  assert.equal(classifyVikUlcinjNotice("javna nabavka i plan rada za 2026"), undefined);
  assert.equal(
    classifyVikUlcinjNotice("utiču na kvalitet i kontinuitet vodosnabdijevanja"),
    undefined,
  );
});

test("retains the canonical article URL for attribution", async () => {
  const { alerts } = await noticeFor(1140, duringJuly);

  assert.equal(alerts[0].sourceUrl, "https://vik-ulcinj.me/2026/07/11/obavjestenje-165/");
  assert.equal(
    alerts[0].source.kind === "source" ? alerts[0].source.value : undefined,
    "Vodovod i kanalizacija Ulcinj",
  );
});

test("expires a notice once its stated day is over, and only then", async () => {
  const beforeService = await noticeFor(1140, new Date("2026-07-11T23:59:00.000Z"));
  const during = await noticeFor(1140, new Date("2026-07-12T08:00:00.000Z"));
  const after = await noticeFor(1140, new Date("2026-07-12T13:00:00.000Z"));

  assert.equal(beforeService.alerts[0].status, "scheduled");
  assert.equal(during.alerts[0].status, "active");
  assert.equal(after.alerts[0].status, "expired");
});

test("retires an undated notice by publication recency instead of leaving it forever", async () => {
  const sameDay = await noticeFor(1136, new Date("2026-07-07T22:00:00.000Z"));
  const muchLater = await noticeFor(1136, new Date("2026-07-20T22:00:00.000Z"));

  assert.equal(sameDay.alerts[0].status, "active");
  assert.equal(muchLater.alerts[0].status, "expired");
});

const snapshotOf = (result: Awaited<ReturnType<typeof refreshVikUlcinj>>) => {
  assert.ok(result.snapshot);
  return result.snapshot;
};

const stubCache = (initial: VikUlcinjCacheSnapshot | null = null) => {
  let stored = initial;
  return {
    read: async () => stored,
    write: async (snapshot: VikUlcinjCacheSnapshot) => {
      stored = snapshot;
    },
  };
};

test("a successful refresh keeps only the water-service announcements", async () => {
  const body = await fixture();
  const cache = stubCache();
  const result = await refreshVikUlcinj({
    cache,
    httpClient: { get: async () => body },
    now: () => duringJuly,
  });

  assert.equal(result.success, true);
  const snapshot = snapshotOf(result);
  assert.equal(snapshot.freshnessStatus, "fresh");
  // Five of the seven fixture posts are water-service announcements; the press release and the
  // holiday notice are not.
  assert.equal(snapshot.alerts.length, 5);
  assert.equal(
    snapshot.alerts.every((alert) => alert.cityIds.includes("ulcinj")),
    true,
  );
});

test("the same announcement twice does not produce two alerts", async () => {
  const posts = JSON.parse(await fixture()) as unknown[];
  const duplicated = JSON.stringify([...posts, ...posts]);
  const single = await refreshVikUlcinj({
    cache: stubCache(),
    httpClient: { get: async () => await fixture() },
    now: () => duringJuly,
  });
  const doubled = await refreshVikUlcinj({
    cache: stubCache(),
    httpClient: { get: async () => duplicated },
    now: () => duringJuly,
  });

  assert.equal(snapshotOf(doubled).alerts.length, snapshotOf(single).alerts.length);
});

test("a successful refresh with no relevant announcements is still a success", async () => {
  const posts = JSON.parse(await fixture()) as { id: number }[];
  const onlyUnrelated = JSON.stringify(posts.filter(({ id }) => id === 1179 || id === 1144));
  const result = await refreshVikUlcinj({
    cache: stubCache(),
    httpClient: { get: async () => onlyUnrelated },
    now: () => duringJuly,
  });

  // This is what lets the UI say "no current interruption" rather than "unavailable".
  assert.equal(result.success, true);
  assert.deepEqual(snapshotOf(result).alerts, []);
  assert.equal(snapshotOf(result).freshnessStatus, "fresh");
});

test("a changed or malformed payload fails safely and keeps the previous snapshot", async () => {
  const previous: VikUlcinjCacheSnapshot = {
    alerts: [],
    fetchedAt: "2026-07-12T00:00:00.000Z",
    freshnessStatus: "fresh",
    lastSuccessfulRefreshAt: "2026-07-12T00:00:00.000Z",
    parserWarnings: [],
    schemaVersion: 1,
    source: "Vodovod i kanalizacija Ulcinj",
    sourceUrl: "https://vik-ulcinj.me/",
  };

  for (const body of ["<!doctype html><html></html>", "{}", "[]"]) {
    const result = await refreshVikUlcinj({
      cache: stubCache(previous),
      httpClient: { get: async () => body },
      now: () => duringJuly,
    });

    assert.equal(result.success, false, body);
    assert.equal(result.retainedPreviousSnapshot, true, body);
    assert.equal(result.snapshot?.freshnessStatus, "stale", body);
  }
});

test("an upstream failure never blanks the city", async () => {
  const previous: VikUlcinjCacheSnapshot = {
    alerts: [],
    fetchedAt: "2026-07-12T00:00:00.000Z",
    freshnessStatus: "fresh",
    lastSuccessfulRefreshAt: "2026-07-12T00:00:00.000Z",
    parserWarnings: [],
    schemaVersion: 1,
    source: "Vodovod i kanalizacija Ulcinj",
    sourceUrl: "https://vik-ulcinj.me/",
  };
  const result = await refreshVikUlcinj({
    cache: stubCache(previous),
    httpClient: {
      get: async () => {
        throw new VikUlcinjError("posts-unavailable", "boom");
      },
    },
    now: () => duringJuly,
  });

  assert.equal(result.success, false);
  assert.equal(result.retainedPreviousSnapshot, true);
  assert.equal(result.errorCode, "posts-unavailable");
  assert.equal(result.snapshot?.freshnessStatus, "stale");
});

test("only requests the official host, and only one bounded page of it", () => {
  assert.throws(() => assertVikUlcinjUrl("https://vik-ulcinj.me.evil.test/wp-json/wp/v2/posts"));
  assert.throws(() => assertVikUlcinjUrl("http://vik-ulcinj.me/wp-json/wp/v2/posts"));
  assert.doesNotThrow(() => assertVikUlcinjUrl(vikUlcinjPostsUrl));

  const url = new URL(vikUlcinjPostsUrl);
  assert.equal(url.hostname, "vik-ulcinj.me");
  assert.equal(url.pathname, "/wp-json/wp/v2/posts");
  assert.equal(url.searchParams.get("per_page"), "20");
  assert.equal(url.searchParams.get("page"), null, "the archive must not be paged through");
});

test("rejects a redirect that leaves the official host", async () => {
  const httpClient = createVikUlcinjHttpClient({
    fetchImplementation: async () => ({
      headers: { get: () => "application/json" },
      ok: true,
      status: 200,
      text: async () => "[]",
      url: "https://elsewhere.test/wp-json/wp/v2/posts",
    }),
  });

  await assert.rejects(() => httpClient.get(vikUlcinjPostsUrl), VikUlcinjError);
});

test("serves cached alerts for Ulcinj and nothing for a city it does not cover", async () => {
  const snapshot: VikUlcinjCacheSnapshot = {
    alerts: [
      {
        affectedArea: { kind: "source", value: "Gač" },
        cityIds: ["ulcinj"],
        dataMode: "live",
        description: { kind: "source", value: "Prekid vodosnabdijevanja." },
        id: "alert-1",
        publishedAt: duringJuly,
        severity: "warning",
        source: { kind: "source", value: "Vodovod i kanalizacija Ulcinj" },
        sourceUrl: "https://vik-ulcinj.me/2026/07/11/obavjestenje-165/",
        status: "active",
        title: { kind: "source", value: "Obavještenje" },
        type: "waterOutage",
      } satisfies CityAlert,
    ],
    fetchedAt: duringJuly.toISOString(),
    freshnessStatus: "fresh",
    lastSuccessfulRefreshAt: duringJuly.toISOString(),
    parserWarnings: [],
    schemaVersion: 1,
    source: "Vodovod i kanalizacija Ulcinj",
    sourceUrl: "https://vik-ulcinj.me/",
  };

  const ulcinj = await getVikUlcinjCityAlerts({
    context: createCityContext("ulcinj", "me"),
    mode: "live",
    now: () => duringJuly,
    readCache: async () => snapshot,
  });
  const podgorica = await getVikUlcinjCityAlerts({
    context: createCityContext("podgorica", "me"),
    mode: "live",
    now: () => duringJuly,
    readCache: async () => snapshot,
  });

  assert.equal(ulcinj.alerts.length, 1);
  assert.equal(ulcinj.freshnessStatus, "fresh");
  assert.deepEqual(podgorica.alerts, []);
  assert.equal(podgorica.freshnessStatus, "unavailable");
});

test("reports unavailable — not empty — when no snapshot exists yet", async () => {
  const result = await getVikUlcinjCityAlerts({
    context: createCityContext("ulcinj", "me"),
    mode: "live",
    now: () => duringJuly,
    readCache: async () => null,
  });

  // "unavailable" is what stops the dashboard claiming there is no interruption.
  assert.equal(result.freshnessStatus, "unavailable");
  assert.deepEqual(result.alerts, []);
});

test("declares coverage for Ulcinj only", () => {
  assert.deepEqual(vikUlcinjProviderMetadata.supportedCityIds, ["ulcinj"]);
  assert.equal(vikUlcinjProviderMetadata.supportsMultipleCities, false);
  assert.equal(vikUlcinjProviderMetadata.id, "vik-ulcinj");
  assert.match(vikUlcinjProviderMetadata.officialSource, /^https:\/\/vik-ulcinj\.me\//u);
});
