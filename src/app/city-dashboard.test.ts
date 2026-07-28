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
