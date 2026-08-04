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

// Regression test for the missing internal path /podgorica -> /podgorica/filmovi. The cinema card
// previously linked only to cineplexx.me, so the sole internal route into /filmovi was the Daily
// Summary tile, whose anchor text is a bare count.
test("links the cinema card onward to the city's own /filmovi listing", async () => {
  const source = await readFile(new URL("./city-dashboard.tsx", import.meta.url), "utf8");

  assert.match(
    source,
    /import \{ getCinemaPath, getContactPath \} from "@\/shared\/config\/public-routes";/u,
  );
  assert.match(source, /viewAllHref=\{getCinemaPath\(city\)\}/u);
  // Derived from the city in scope — never a literal path or a city-specific branch.
  assert.doesNotMatch(source, /"\/podgorica/u);
  assert.doesNotMatch(source, /viewAllHref="/u);
});

test("keeps the cinema link gated on route availability, not on the events capability", async () => {
  const source = await readFile(new URL("./city-dashboard.tsx", import.meta.url), "utf8");
  const cinemaBlock = /\{cinemaAvailable \? \(([\s\S]*?)\) : null\}/u.exec(source)?.[1];

  assert.ok(cinemaBlock, "the cinema block must stay behind cinemaAvailable");
  // The onward link lives inside that block, so a city without a cinema route never emits it.
  assert.match(cinemaBlock, /viewAllHref=\{getCinemaPath\(city\)\}/u);
});

test("leaves the other dashboard module sections and their links untouched", async () => {
  const source = await readFile(new URL("./city-dashboard.tsx", import.meta.url), "utf8");

  assert.match(source, /<HomepageEventsCard/u);
  assert.match(source, /<GoingOutSection/u);
  assert.match(source, /<AirportFlightsCard/u);
  assert.match(source, /<SeaWaterQualityCard/u);
  assert.match(source, /<AdvertisingCard\n\s+href=\{getContactPath\(\)\}/u);
});

// The dashboard cinema card is a teaser into our own listing, so it must not also dangle an
// off-site exit. The Cineplexx CTA now belongs to /[city]/filmovi alone.
test("the dashboard cinema card offers the internal listing and no external Cineplexx CTA", async () => {
  const source = await readFile(new URL("./city-dashboard.tsx", import.meta.url), "utf8");
  const card = await readFile(
    new URL("../modules/events/presentation/cineplexx-programme-card.tsx", import.meta.url),
    "utf8",
  );

  // The dashboard passes viewAllHref, which is exactly the condition that suppresses the CTA.
  assert.match(source, /viewAllHref=\{getCinemaPath\(city\)\}/u);
  assert.match(card, /\{!viewAllHref && \(displayState === "programme"/u);
  assert.doesNotMatch(source, /cineplexx\.me/u);
});
