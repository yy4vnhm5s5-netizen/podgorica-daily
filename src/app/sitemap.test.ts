import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

import sitemap, {
  dynamic,
  getGoingOutDetailSitemapEntries,
  getSeaWaterQualitySitemapEntries,
} from "./sitemap.ts";
import { isCityPublicFeatureRouteAvailable } from "./city-routing.ts";
import { podgoricaEvent } from "@/modules/events/__fixtures__/events";
import { isEventSitemapEligible } from "@/modules/events/domain/event-lifecycle";
import { getCityEventsForPublicListing } from "@/modules/events/presentation/events-ui-model";
import { parseBudvaSeaWaterQualitySummary } from "@/modules/sea-water-quality/infrastructure/budva-sea-water-quality";
import { mergeSeaWaterQualityHistoryBackfill } from "@/modules/sea-water-quality/infrastructure/sea-water-quality-history-cache";
import type { SeaWaterQualitySupportedCityId } from "@/modules/sea-water-quality/infrastructure/sea-water-quality-cities";
import { getActiveCities, getCity } from "@/shared/config/cities";
import {
  getEventDetailPath,
  getEventsPath,
  getGoingOutDetailPath,
} from "@/shared/config/public-routes";
import type { GoingOutEvent } from "@/modules/going-out/domain/going-out-event";
import type { City } from "@/shared/types/city";

test("publishes only canonical indexable public routes", async () => {
  const urls = (await sitemap()).map(({ url }) => new URL(url).pathname);

  assert.deepEqual(
    [
      "/podgorica",
      "/podgorica/dogadjaji",
      "/podgorica/izlasci",
      "/podgorica/filmovi",
      "/podgorica/letovi",
      "/podgorica/struja",
    ].every((path) => urls.includes(path)),
    true,
  );
  assert.equal(urls.includes("/"), true);
  assert.equal(urls.includes("/budva"), true);
  assert.equal(urls.includes("/budva/izlasci"), true);
  assert.equal(urls.includes("/budva/struja"), true);
  assert.equal(urls.includes("/o-platformi"), true);
  assert.equal(
    urls.some((path) => path.startsWith("/api/")),
    false,
  );
  assert.equal(urls.includes("/budva/dogadjaji"), false);
  assert.equal(urls.includes("/budva/filmovi"), false);
  assert.equal(urls.includes("/budva/letovi"), false);
  assert.equal(urls.includes("/bar"), true);
  assert.equal(urls.includes("/bar/struja"), true);
  assert.equal(urls.includes("/bar/izlasci"), true);
  assert.equal(urls.includes("/bar/plaze"), true);
  for (const path of [
    "/bar/dogadjaji",
    "/bar/filmovi",
    "/bar/letovi",
    "/bar/vozovi",
    "/bar/voda",
  ]) {
    assert.equal(urls.includes(path), false, path);
  }
  assert.equal(urls.includes("/kotor"), true);
  assert.equal(urls.includes("/kotor/izlasci"), true);
  assert.equal(urls.includes("/kotor/struja"), true);
  assert.equal(urls.includes("/kotor/voda"), false);
  assert.equal(urls.includes("/kotor/dogadjaji"), false);
  assert.equal(urls.includes("/kotor/filmovi"), false);
  assert.equal(urls.includes("/kotor/letovi"), false);
  assert.equal(urls.includes("/kotor/vozovi"), false);
  assert.equal(urls.includes("/kotor/plaze"), true);
  assert.equal(urls.includes("/tivat"), true);
  assert.equal(urls.includes("/tivat/dogadjaji"), true);
  assert.equal(urls.includes("/tivat/izlasci"), true);
  assert.equal(urls.includes("/tivat/struja"), true);
  assert.equal(urls.includes("/tivat/plaze"), true);
  // Tivat has the generic "events" capability (Tourism Tivat provider) but not Cineplexx, which
  // is Podgorica-only — it must not get a /filmovi sitemap entry that can only ever 404 or show
  // "no movies". See isCityCinemaRouteAvailable in city-routing.ts.
  assert.equal(urls.includes("/tivat/filmovi"), false);
  assert.equal(urls.includes("/tivat/letovi"), false);
});

test("adds only capability-supported beach detail URLs from local history snapshots", async () => {
  const budva = getCity("budva");
  const podgorica = getCity("podgorica");
  assert.ok(budva);
  assert.ok(podgorica);

  const entries = await getSeaWaterQualitySitemapEntries([budva, podgorica], async () => ({
    history: {
      latestRound: 5,
      locations: [
        {
          canonicalSlug: "jaz-01",
          displayName: "Jaz 01",
          firstSeenRound: 4,
          lastSeenRound: 5,
          measurements: [{ grade: "excellent", sourceRound: 5 }],
          presentInLatestRound: true,
          sourceLocationId: 36,
        },
      ],
      municipality: "budva",
      sourceMunicipalityId: 2,
      year: 2026,
    },
    lastSuccessfulRefreshAt: "2026-07-24T10:00:00.000Z",
    state: "fresh",
  }));

  assert.deepEqual(
    entries.map(({ url }) => new URL(url).pathname),
    ["/budva/plaze/jaz-01"],
  );
});

// Drives the sitemap with the inventory a complete 2026 backfill actually produces, built from the
// official national R4/R5 fixtures through the real parser + backfill merge — so the expected
// per-city counts are derived from JPMD data rather than hardcoded.
async function buildBackfilledHistories() {
  const [round4, round5] = await Promise.all(
    [4, 5].map((round) =>
      readFile(
        join(
          process.cwd(),
          `src/modules/sea-water-quality/infrastructure/__fixtures__/jpmd-2026-round-${round}-full.json`,
        ),
        "utf8",
      ),
    ),
  );
  const cityIds: SeaWaterQualitySupportedCityId[] = ["bar", "budva", "kotor", "tivat"];

  return new Map(
    cityIds.map((cityId) => {
      const history = [round4, round5].reduce<
        ReturnType<typeof mergeSeaWaterQualityHistoryBackfill> | undefined
      >((previous, body, index) => {
        const parsed = parseBudvaSeaWaterQualitySummary(body, cityId);
        assert.ok(parsed, `expected the official fixture to parse for ${cityId}`);
        return mergeSeaWaterQualityHistoryBackfill({
          cityId,
          ...(previous ? { previous } : {}),
          round: index + 4,
          summaryLocations: parsed.summary.locations,
          year: 2026,
        });
      }, undefined);
      assert.ok(history);
      return [cityId, history];
    }),
  );
}

test("emits one canonical detail URL per backfilled location per supported city", async () => {
  const histories = await buildBackfilledHistories();
  const entries = await getSeaWaterQualitySitemapEntries(getActiveCities(), async (context) => {
    const history = histories.get(context.city.id as SeaWaterQualitySupportedCityId);
    return history
      ? { history, lastSuccessfulRefreshAt: "2026-08-01T00:00:00.000Z", state: "fresh" }
      : { state: "unavailable" };
  });
  const paths = entries.map(({ url }) => new URL(url).pathname);
  const countFor = (citySlug: string) =>
    paths.filter((path) => path.startsWith(`/${citySlug}/plaze/`)).length;

  // Counts are asserted against the histories just derived from the official source, not literals.
  assert.equal(countFor("bar"), histories.get("bar")!.locations.length);
  assert.equal(countFor("budva"), histories.get("budva")!.locations.length);
  assert.equal(countFor("kotor"), histories.get("kotor")!.locations.length);
  assert.equal(countFor("tivat"), histories.get("tivat")!.locations.length);
  assert.equal(
    paths.length,
    [...histories.values()].reduce((total, history) => total + history.locations.length, 0),
  );

  // Every emitted URL is a canonical slug belonging to a supported city, and appears exactly once.
  assert.equal(new Set(paths).size, paths.length, "sitemap must not contain duplicate URLs");
  const canonicalSlugs = new Set(
    [...histories].flatMap(([cityId, history]) =>
      history.locations.map((location) => `/${cityId}/plaze/${location.canonicalSlug}`),
    ),
  );
  for (const path of paths) {
    assert.ok(canonicalSlugs.has(path), `${path} must be a canonical supported-city URL`);
  }
});

test("excludes cities and municipalities that are not supported sea-water cities", async () => {
  const histories = await buildBackfilledHistories();
  const entries = await getSeaWaterQualitySitemapEntries(getActiveCities(), async (context) => {
    const history = histories.get(context.city.id as SeaWaterQualitySupportedCityId);
    return history
      ? { history, lastSuccessfulRefreshAt: "2026-08-01T00:00:00.000Z", state: "fresh" }
      : { state: "unavailable" };
  });
  const paths = entries.map(({ url }) => new URL(url).pathname);

  assert.equal(
    paths.some((path) => path.startsWith("/podgorica/")),
    false,
    "Podgorica has no seaWaterQuality capability",
  );
  // Herceg Novi and Ulcinj are in the national JPMD response but are not Gradom.me cities.
  for (const municipality of ["herceg-novi", "hercegnovi", "ulcinj"]) {
    assert.equal(
      paths.some((path) => path.includes(municipality)),
      false,
      `${municipality} must never reach the sitemap`,
    );
  }
});

// Regression guard for the production incident where /sitemap.xml contained zero /plaze/ detail
// URLs after a successful backfill. Railway builds the image without the /app/.runtime volume, so
// any build-time render of this route sees an empty runtime-derived inventory. A revalidate window
// is not sufficient: it still emits that empty prerender as the initial payload after every
// deploy. The route must opt out of build-time rendering entirely.
test("reads runtime snapshots per request instead of being prerendered at build", async () => {
  const source = await readFile(join(process.cwd(), "src/app/sitemap.ts"), "utf8");

  assert.equal(dynamic, "force-dynamic");
  assert.match(source, /^export const dynamic = "force-dynamic";$/mu);
  // A revalidate window would reintroduce the build-time payload after each deploy.
  assert.doesNotMatch(source, /^export const revalidate\b/mu);
  // Must never reach upstream JPMD while generating.
  assert.doesNotMatch(source, /fetch\(|morskodobro/iu);
});

test("keeps the rest of the sitemap when one city's history is missing or corrupt", async () => {
  const histories = await buildBackfilledHistories();
  const entries = await getSeaWaterQualitySitemapEntries(getActiveCities(), async (context) => {
    if (context.city.id === "budva") throw new Error("corrupt history snapshot");
    const history = histories.get(context.city.id as SeaWaterQualitySupportedCityId);
    return history
      ? { history, lastSuccessfulRefreshAt: "2026-08-01T00:00:00.000Z", state: "fresh" }
      : { state: "unavailable" };
  });
  const paths = entries.map(({ url }) => new URL(url).pathname);

  assert.equal(
    paths.some((path) => path.startsWith("/budva/plaze/")),
    false,
  );
  assert.equal(paths.length > 0, true, "other cities must still be published");
  assert.equal(
    paths.filter((path) => path.startsWith("/bar/plaze/")).length,
    histories.get("bar")!.locations.length,
  );
});

test("event entries are filtered by the explicit lifecycle rule, not by whatever the snapshot holds", async () => {
  const source = await readFile(new URL("./sitemap.ts", import.meta.url), "utf8");

  assert.match(source, /import \{ isEventSitemapEligible \}/u);
  assert.match(source, /isEventSitemapEligible\(event, \{ now, timezone: context\.timezone \}\)/u);
  // The city's own timezone decides the day boundary — no hardcoded zone, no UTC assumption.
  assert.doesNotMatch(source, /timezone: "Europe\/Podgorica"/u);
});

test("never emits the same URL twice", async () => {
  const urls = (await sitemap()).map(({ url }) => url);

  assert.deepEqual(urls.length, new Set(urls).size);
});

test("publishes only current, detail-eligible Going Out events from their city snapshot", async () => {
  const kotor = getCity("kotor");
  assert.ok(kotor);
  const now = new Date("2026-08-10T10:00:00.000Z");
  const eligible: GoingOutEvent = {
    city: "kotor",
    description: "Koncert na otvorenom uz lokalne izvođače.",
    id: "kotor-concert",
    sourceEventId: "7465",
    sourceName: "MonteGigs",
    sourceUrl: "https://staging.montegigs.me/me/events/kotor/7465-20260812-koncert-u-kotoru",
    startDate: "2026-08-12",
    title: "Koncert u Kotoru",
  };
  const entries = await getGoingOutDetailSitemapEntries(
    [kotor],
    async () => ({
      events: [eligible, { ...eligible, description: undefined, id: "missing-description" }],
      state: "fresh" as const,
    }),
    now,
  );

  assert.deepEqual(
    entries.map(({ url }) => new URL(url).pathname),
    [getGoingOutDetailPath(kotor, "montegigs", "7465")],
  );
});

test("omits Going Out details when a city snapshot is unavailable", async () => {
  const kotor = getCity("kotor");
  assert.ok(kotor);
  const entries = await getGoingOutDetailSitemapEntries([kotor], async () => ({
    events: [],
    state: "unavailable" as const,
  }));

  assert.deepEqual(entries, []);
});

test("does not read or publish Going Out details for an inactive city without the capability", async () => {
  const niksic = getCity("niksic");
  assert.ok(niksic);
  let read = false;

  const entries = await getGoingOutDetailSitemapEntries([niksic], async () => {
    read = true;
    return { events: [], state: "fresh" as const };
  });

  assert.equal(read, false);
  assert.deepEqual(entries, []);
});

test("applies the event lifecycle policy per city without leaking events across cities", () => {
  // Composes exactly what sitemap() composes — the public-listing filter and the lifecycle rule —
  // against a deterministic reference instant, so the boundary is asserted on real event shapes.
  const now = new Date("2026-08-03T12:00:00.000Z");
  const podgorica = getCity("podgorica");
  const tivat = getCity("tivat");
  assert.ok(podgorica);
  assert.ok(tivat);

  const events = [
    podgoricaEvent({ id: "event_upcoming", startsAt: "2026-08-10T18:00:00.000Z" }),
    podgoricaEvent({ id: "event_today", startDate: "2026-08-03", startsAt: undefined }),
    podgoricaEvent({ id: "event_ended_yesterday", startDate: "2026-08-02", startsAt: undefined }),
    podgoricaEvent({ id: "event_ended_long_ago", startDate: "2026-07-05", startsAt: undefined }),
    podgoricaEvent({
      id: "event_cineplexx",
      sourceId: "cineplexx-podgorica",
      startsAt: "2026-08-10T18:00:00.000Z",
    }),
    podgoricaEvent({
      cityId: "tivat",
      cityIds: ["tivat"],
      id: "event_tivat_upcoming",
      startsAt: "2026-08-10T18:00:00.000Z",
    }),
  ];

  const selectFor = (city: City) =>
    getCityEventsForPublicListing(events.filter((event) => event.cityId === city.id))
      .filter((event) => isEventSitemapEligible(event, { now, timezone: city.timezone }))
      .map((event) => event.id);

  assert.deepEqual(selectFor(podgorica), [
    "event_upcoming",
    "event_today",
    "event_ended_yesterday",
  ]);
  // Cineplexx programme events are excluded from the public surface entirely, so they are never
  // sitemap candidates regardless of lifecycle.
  assert.equal(selectFor(podgorica).includes("event_cineplexx"), false);
  assert.deepEqual(selectFor(tivat), ["event_tivat_upcoming"]);
});

test("canonical event URLs are unchanged by the lifecycle rule", () => {
  const podgorica = getCity("podgorica");
  assert.ok(podgorica);
  const event = podgoricaEvent({ id: "event_ended", startDate: "2026-08-02", startsAt: undefined });
  const upcoming = podgoricaEvent({ id: "event_ended", startsAt: "2026-08-10T18:00:00.000Z" });

  // Same ID in and out of the window: leaving the sitemap must never rewrite the canonical path.
  assert.equal(getEventDetailPath(podgorica, event.id), "/podgorica/dogadjaji/event_ended");
  assert.equal(getEventDetailPath(podgorica, event.id), getEventDetailPath(podgorica, upcoming.id));
});

test("event detail URLs are gated on the same public-route rule as the events listing path", async () => {
  const source = await readFile(new URL("./sitemap.ts", import.meta.url), "utf8");
  const paths = (await sitemap()).map(({ url }) => new URL(url).pathname);

  // One shared rule for both, so the listing route and its detail URLs can never disagree.
  assert.match(
    source,
    /\.filter\(\(city\) => isCityPublicFeatureRouteAvailable\(city, "events"\)\)/u,
  );
  assert.doesNotMatch(source, /supportsCityCapability\(city, "events"\)/u);

  for (const city of getActiveCities()) {
    const listingPath = getEventsPath(city);
    const isAvailable = isCityPublicFeatureRouteAvailable(city, "events");

    assert.equal(paths.includes(listingPath), isAvailable, city.id);
    if (!isAvailable) {
      assert.equal(
        paths.some((path) => path.startsWith(`${listingPath}/`)),
        false,
        `${city.id} must not advertise event detail URLs`,
      );
    }
  }
});

test("a city without the events capability contributes no event detail URLs", async () => {
  const paths = (await sitemap()).map(({ url }) => new URL(url).pathname);

  for (const cityId of ["bar", "budva", "kotor"]) {
    const city = getCity(cityId);
    assert.ok(city);
    assert.equal(isCityPublicFeatureRouteAvailable(city, "events"), false, cityId);
    assert.equal(
      paths.some((path) => path.startsWith(`${getEventsPath(city)}/`)),
      false,
      cityId,
    );
  }
});

test("the shared gate refuses a capability whose feature flag is switched off", () => {
  const podgorica = getCity("podgorica");
  const budva = getCity("budva");
  assert.ok(podgorica);
  assert.ok(budva);
  const disabled = { isFeatureEnabled: () => false };

  // The gate the sitemap now uses is the one that honours feature flags: a supported city loses a
  // flag-gated route the moment the flag is off.
  assert.equal(isCityPublicFeatureRouteAvailable(budva, "seaWaterQuality"), true);
  assert.equal(isCityPublicFeatureRouteAvailable(budva, "seaWaterQuality", disabled), false);
  assert.equal(isCityPublicFeatureRouteAvailable(budva, "goingOut", disabled), false);

  // `events` is currently capability-only — it is deliberately absent from
  // publicFeatureByCityCapability in shared/config/city-routes.ts, so no flag suppresses it today.
  // Routing this call site through the shared helper is what makes adding it there later take
  // effect in the sitemap too, instead of being silently missed.
  assert.equal(isCityPublicFeatureRouteAvailable(podgorica, "events", disabled), true);
});

test("stamps each beach detail URL with its own newest sampling date", async () => {
  const budva = getCity("budva");
  assert.ok(budva);
  const history = {
    latestRound: 5,
    locations: [
      {
        canonicalSlug: "jaz-01",
        displayName: "Jaz 01",
        firstSeenRound: 1,
        lastSeenRound: 5,
        measurements: [
          { grade: "excellent" as const, samplingDate: "2026-06-08", sourceRound: 1 },
          { grade: "good" as const, samplingDate: "2026-07-20", sourceRound: 2 },
        ],
        presentInLatestRound: true,
        sourceLocationId: 1,
      },
      {
        canonicalSlug: "jaz-02",
        displayName: "Jaz 02",
        firstSeenRound: 1,
        lastSeenRound: 5,
        measurements: [{ grade: "excellent" as const, samplingDate: "2026-07-23", sourceRound: 2 }],
        presentInLatestRound: true,
        sourceLocationId: 2,
      },
      {
        canonicalSlug: "jaz-03",
        displayName: "Jaz 03",
        firstSeenRound: 1,
        lastSeenRound: 5,
        // No dated measurement at all.
        measurements: [{ grade: "excellent" as const, sourceRound: 2 }],
        presentInLatestRound: true,
        sourceLocationId: 3,
      },
    ],
    municipality: "budva" as const,
    sourceMunicipalityId: 2,
    year: 2026,
  };
  const entries = await getSeaWaterQualitySitemapEntries([budva], async () => ({
    history,
    lastSuccessfulRefreshAt: undefined,
    state: "fresh" as const,
  }));
  const byUrl = new Map(entries.map((entry) => [entry.url, entry.lastModified]));

  // Newest sampling date wins, and two locations get genuinely different dates.
  assert.deepEqual(
    byUrl.get("https://gradom.me/budva/plaze/jaz-01"),
    new Date("2026-07-20T00:00:00.000Z"),
  );
  assert.deepEqual(
    byUrl.get("https://gradom.me/budva/plaze/jaz-02"),
    new Date("2026-07-23T00:00:00.000Z"),
  );
  // No date in the data means no lastModified — never a fabricated or current-time fallback.
  assert.equal(byUrl.get("https://gradom.me/budva/plaze/jaz-03"), undefined);
  assert.equal(byUrl.size, 3);
});

test("never falls back to generation time for a beach lastModified", async () => {
  const source = await readFile(new URL("./sitemap.ts", import.meta.url), "utf8");

  assert.match(source, /const lastModified = getLatestSamplingDate\(location\);/u);
  assert.match(source, /\.\.\.\(lastModified \? \{ lastModified \} : \{\}\)/u);
  // The only Date constructed for a beach entry is the anchored sampling date.
  assert.match(source, /new Date\(`\$\{newest\}T00:00:00\.000Z`\)/u);
  assert.doesNotMatch(source, /lastModified: new Date\(\)/u);
});

test("emits only Ulcinj's supported route family", async () => {
  const ulcinj = getCity("ulcinj");
  assert.ok(ulcinj);
  const paths = (await sitemap()).map(({ url }) => new URL(url).pathname);
  const ulcinjPaths = paths.filter((path) => path === "/ulcinj" || path.startsWith("/ulcinj/"));

  assert.ok(ulcinjPaths.includes("/ulcinj"));
  assert.ok(ulcinjPaths.includes("/ulcinj/plaze"));
  assert.ok(ulcinjPaths.includes("/ulcinj/izlasci"));
  // Added by the electricity capability alone, through the generic capability-driven sitemap
  // builder — sitemap.ts names no city and gained no Ulcinj branch.
  assert.ok(ulcinjPaths.includes("/ulcinj/struja"));
  // Nothing without a verified provider may become indexable. Water has a provider but no
  // standalone route: it is a City Services tab, so it must still never appear here.
  for (const unsupported of [
    "/ulcinj/dogadjaji",
    "/ulcinj/filmovi",
    "/ulcinj/letovi",
    "/ulcinj/vozovi",
    "/ulcinj/voda",
  ]) {
    assert.equal(ulcinjPaths.includes(unsupported), false, unsupported);
  }
  // Every remaining Ulcinj URL is a beach detail page derived from the history snapshot.
  for (const path of ulcinjPaths) {
    const isKnown =
      ["/ulcinj", "/ulcinj/plaze", "/ulcinj/izlasci", "/ulcinj/struja"].includes(path) ||
      path.startsWith("/ulcinj/plaze/");
    assert.equal(isKnown, true, path);
  }
});

test("keeps beach lastModified per location rather than per city", async () => {
  const source = await readFile(new URL("./sitemap.ts", import.meta.url), "utf8");

  // Unchanged by the Ulcinj release: the date still comes from each location's newest sample.
  assert.match(source, /const lastModified = getLatestSamplingDate\(location\);/u);
  assert.doesNotMatch(source, /ulcinj/iu);
});
