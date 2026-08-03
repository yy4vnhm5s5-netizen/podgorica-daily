import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

import sitemap, { getSeaWaterQualitySitemapEntries } from "./sitemap.ts";
import { parseBudvaSeaWaterQualitySummary } from "@/modules/sea-water-quality/infrastructure/budva-sea-water-quality";
import { mergeSeaWaterQualityHistoryBackfill } from "@/modules/sea-water-quality/infrastructure/sea-water-quality-history-cache";
import type { SeaWaterQualitySupportedCityId } from "@/modules/sea-water-quality/infrastructure/sea-water-quality-cities";
import { getActiveCities, getCity } from "@/shared/config/cities";

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
