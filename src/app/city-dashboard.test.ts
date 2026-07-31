import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("gates the Cineplexx cinema block behind isCityCinemaRouteAvailable, not the generic events capability", async () => {
  const source = await readFile(new URL("./city-dashboard.tsx", import.meta.url), "utf8");

  assert.match(
    source,
    /import \{\s*getCityDashboardSummaryAvailability,\s*isCityCinemaRouteAvailable,\s*\} from "@\/app\/city-routing";/u,
  );
  assert.match(source, /const cinemaAvailable = isCityCinemaRouteAvailable\(city\);/u);
  assert.match(
    source,
    /className=\{cinemaAvailable \? "grid items-start gap-6 lg:grid-cols-2" : undefined\}/u,
  );

  // The events section spans from the capabilities.events gate to the compact-modules section, so
  // this slice contains exactly HomepageEventsCard and the Cineplexx sub-block and nothing else.
  const eventsSectionStart = source.indexOf("{capabilities.events ? (");
  const eventsSectionEnd = source.indexOf("{compactModuleCount > 0 ? (");
  assert.ok(eventsSectionStart >= 0 && eventsSectionEnd > eventsSectionStart);
  const eventsSection = source.slice(eventsSectionStart, eventsSectionEnd);

  assert.match(eventsSection, /<HomepageEventsCard/u);
  assert.match(eventsSection, /\{cinemaAvailable \? \(\s*<div id="bioskop">/u);
  assert.match(eventsSection, /<CineplexxProgrammeCard/u);

  // HomepageEventsCard must render for every events-capable city; only the id="bioskop" block
  // (Cineplexx, Podgorica-only) is behind the cinemaAvailable ternary, so it must appear later.
  const homepageEventsCardIndex = eventsSection.indexOf("<HomepageEventsCard");
  const cinemaGateIndex = eventsSection.indexOf("cinemaAvailable ? (");
  assert.ok(homepageEventsCardIndex >= 0 && cinemaGateIndex > homepageEventsCardIndex);
});

// Regression test: the dashboard's movie stat used to be derived from cinemaProgramme.events (the
// same ≤3-item, today/tomorrow-only set the teaser card displays), which could never reach the
// true movie count shown on /filmovi. It must use the same canonical selector as the platform
// homepage highlight and the /filmovi page, while the teaser card itself keeps its own limit={3}.
test("derives the dashboard's movie count from the canonical selector, not the capped teaser event list", async () => {
  const source = await readFile(new URL("./city-dashboard.tsx", import.meta.url), "utf8");

  assert.match(
    source,
    /import \{\s*selectHomepageCinemaProgramme,\s*selectMoviesWithUpcomingScreenings,\s*\} from "@\/modules\/events\/presentation\/cineplexx-programme-ui-model";/u,
  );
  assert.doesNotMatch(source, /getDistinctCineplexxProgrammeMovieCount/u);
  assert.doesNotMatch(source, /selectCurrentCineplexxMovies/u);
  assert.match(
    source,
    /const displayableCinemaMovieCount = selectMoviesWithUpcomingScreenings\(cinemaEvents, \{\s*now,\s*\}\)\.length;/u,
  );
  assert.match(source, /<CineplexxProgrammeCard[\s\S]*?limit=\{3\}/u);
});

test("prioritizes Going Out only for the main city while restoring sea water before it for other cities", async () => {
  const source = await readFile(new URL("./city-dashboard.tsx", import.meta.url), "utf8");
  const dashboardMarkup = source.slice(source.indexOf("return ("));

  const cityAlertsIndex = dashboardMarkup.indexOf("<CityAlertsSection");
  const seaWaterBeforeGoingOutIndex = dashboardMarkup.indexOf('<DashboardSection tone="cyan">');
  const goingOutIndex = dashboardMarkup.indexOf("<GoingOutSection");
  const compactModulesIndex = dashboardMarkup.indexOf("{compactModuleCount > 0 ? (");

  assert.ok(cityAlertsIndex >= 0 && seaWaterBeforeGoingOutIndex > cityAlertsIndex);
  assert.ok(goingOutIndex > seaWaterBeforeGoingOutIndex);
  assert.ok(compactModulesIndex > goingOutIndex);
  assert.match(
    source,
    /const showSeaWaterBeforeGoingOut = !city\.isMain && seaWaterCard !== null;/u,
  );
  assert.match(source, /\{city\.isMain \? seaWaterCard : null\}/u);
  assert.match(
    source,
    /className=\{\s*compactModuleCount > 1 \? "grid items-start gap-6 lg:grid-cols-2" : undefined\s*\}/u,
  );

  const goingOutRow = dashboardMarkup.slice(
    goingOutIndex,
    dashboardMarkup.indexOf("{capabilities.events ? (", goingOutIndex),
  );
  assert.doesNotMatch(goingOutRow, /SeaWaterQualityCard/u);
});

test("keeps the Daily Summary as an unwrapped dashboard hero", async () => {
  const source = await readFile(new URL("./city-dashboard.tsx", import.meta.url), "utf8");
  const dashboardMarkup = source.slice(
    source.indexOf('<section className="space-y-8 sm:space-y-10"'),
  );
  const dailySummaryIndex = dashboardMarkup.indexOf("<DailySummaryBar");
  const firstRegionIndex = dashboardMarkup.indexOf("<DashboardSection>");

  assert.doesNotMatch(source, /<DashboardSection first>/u);
  assert.ok(dailySummaryIndex >= 0 && firstRegionIndex > dailySummaryIndex);
});

test("places the existing advertising banner after Gradske usluge", async () => {
  const source = await readFile(new URL("./city-dashboard.tsx", import.meta.url), "utf8");
  const dashboardMarkup = source.slice(source.indexOf("return ("));
  const dailySummaryIndex = dashboardMarkup.indexOf("<DailySummaryBar");
  const advertisingIndex = dashboardMarkup.indexOf("<AdvertisingCard");
  const cityAlertsIndex = dashboardMarkup.indexOf("<CityAlertsSection");

  assert.ok(dailySummaryIndex >= 0 && advertisingIndex > dailySummaryIndex);
  assert.ok(cityAlertsIndex >= 0 && cityAlertsIndex < advertisingIndex);
  assert.match(source, /\? "space-y-4 sm:space-y-5"/u);
});

test("uses only background-region tones for city services, sea water and Going Out", async () => {
  const source = await readFile(new URL("./city-dashboard.tsx", import.meta.url), "utf8");

  assert.match(source, /<DashboardSection tone="cyan">\{seaWaterCard\}<\/DashboardSection>/u);
  assert.match(source, /<DashboardSection tone="violet">\s*<GoingOutSection/u);
  assert.match(source, /<DashboardSection>\s*<Suspense/u);
});
