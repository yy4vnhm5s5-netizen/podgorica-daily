import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("gates the Cineplexx cinema block behind isCityCinemaRouteAvailable, not the generic events capability", async () => {
  const source = await readFile(new URL("./city-dashboard.tsx", import.meta.url), "utf8");

  assert.match(
    source,
    /import \{ getCityDashboardSummaryAvailability, isCityCinemaRouteAvailable \} from "@\/app\/city-routing";/u,
  );
  assert.match(source, /const cinemaAvailable = isCityCinemaRouteAvailable\(city\);/u);
  assert.match(
    source,
    /className=\{cinemaAvailable \? "grid items-start gap-5 lg:grid-cols-2" : undefined\}/u,
  );

  // The events section spans from the capabilities.events gate to the next sibling section, so
  // this slice contains exactly HomepageEventsCard and the Cineplexx sub-block and nothing else.
  const eventsSectionStart = source.indexOf("{capabilities.events ? (");
  const eventsSectionEnd = source.indexOf("<AdvertisingCard");
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
