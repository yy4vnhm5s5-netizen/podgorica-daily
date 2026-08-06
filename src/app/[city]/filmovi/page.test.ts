import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { isCityCinemaRouteAvailable } from "@/app/city-routing";
import { getActiveCities, getCity, getCityName } from "@/shared/config/cities";
import { getCinemaPath } from "@/shared/config/public-routes";
import { getPageTitle } from "@/shared/config/site";

test("the cinema route is /filmovi, matching getCinemaPath", () => {
  const podgorica = getCity("podgorica");
  assert.ok(podgorica);
  assert.equal(getCinemaPath(podgorica), "/podgorica/filmovi");
});

// Regression test for the /podgorica-vs-/podgorica/filmovi movie-count mismatch: this page used to
// reuse selectHomepageCinemaProgramme (the homepage teaser's today/tomorrow-only, ≤3-event
// selector), so it could never show every movie with an upcoming screening the homepage highlight
// counted.
test("shows every upcoming Cineplexx screening via selectUpcomingCineplexxScreenings, not the homepage teaser selector", async () => {
  const source = await readFile(new URL("./page.tsx", import.meta.url), "utf8");

  assert.doesNotMatch(source, /selectHomepageCinemaProgramme/u);
  assert.match(
    source,
    /import \{ selectUpcomingCineplexxScreenings \} from "@\/modules\/events\/presentation\/cineplexx-programme-ui-model";/u,
  );
  assert.match(
    source,
    /const screenings = selectUpcomingCineplexxScreenings\(cinemaEvents, \{ now: new Date\(\) \}\);/u,
  );
  // No `limit` prop passed — CineplexxProgrammeCard shows every movie in `screenings`, not a
  // hardcoded slice.
  assert.match(
    source,
    /<CineplexxProgrammeCard events=\{screenings\} locale=\{locale\} state=\{providerState\} \/>/u,
  );
  assert.doesNotMatch(source, /limit=\{/u);
});

// Regression test for the production title "Filmovi u Podgorica | Gradom.me". "u" governs the
// locative in Montenegrin, so the nominative `city.name` was grammatically wrong.
test("titles the cinema page with the locative city form", () => {
  const podgorica = getCity("podgorica");
  assert.ok(podgorica);

  assert.equal(
    getPageTitle(`Filmovi u ${getCityName(podgorica, "locative")}`),
    "Filmovi u Podgorici | Gradom.me",
  );
});

test("derives the city form from the shared grammar model rather than naming Podgorica", async () => {
  const source = await readFile(new URL("./page.tsx", import.meta.url), "utf8");

  assert.match(source, /const cityName = getCityName\(context\.city, "locative"\);/u);
  assert.match(source, /const title = `Filmovi u \$\{cityName\}`;/u);
  // The nominative must not reappear in any user-facing metadata string on this route.
  assert.doesNotMatch(source, /u \$\{context\.city\.name\}/u);
  // No city baked into either metadata string (the word appears only in the explanatory comment).
  assert.doesNotMatch(source, /`Filmovi u [^$]/u, "no city may be hardcoded in the title");
  assert.doesNotMatch(source, /bioskopa u [^$]/u, "no city may be hardcoded in the description");
});

test("gives the fuller cinema meta description the same locative treatment as the title", async () => {
  const source = await readFile(new URL("./page.tsx", import.meta.url), "utf8");
  const podgorica = getCity("podgorica");
  assert.ok(podgorica);

  assert.match(
    source,
    /const description = `Aktuelni Cineplexx repertoar u \$\{cityName\}: filmovi i termini projekcija\.`;/u,
  );
  assert.equal(
    `Aktuelni Cineplexx repertoar u ${getCityName(podgorica, "locative")}: filmovi i termini projekcija.`,
    "Aktuelni Cineplexx repertoar u Podgorici: filmovi i termini projekcija.",
  );
});

test("every cinema-capable city gets a grammatical title, not just Podgorica", () => {
  for (const city of getActiveCities().filter((candidate) =>
    isCityCinemaRouteAvailable(candidate),
  )) {
    const title = `Filmovi u ${getCityName(city, "locative")}`;

    assert.doesNotMatch(title, new RegExp(`u ${city.name}$`, "u"), city.id);
    assert.equal(title, `Filmovi u ${city.locativeName ?? city.name}`, city.id);
  }
});

test("canonical URL remains unchanged by the grammar fix", async () => {
  const source = await readFile(new URL("./page.tsx", import.meta.url), "utf8");

  assert.match(source, /canonical: getCinemaPath\(context\.city\),/u);
});

test("the listing page keeps the external Cineplexx programme link", async () => {
  const source = await readFile(new URL("./page.tsx", import.meta.url), "utf8");
  const card = await readFile(
    new URL("../../../modules/events/presentation/cineplexx-programme-card.tsx", import.meta.url),
    "utf8",
  );

  // This page passes no viewAllHref (it *is* the listing), which is what keeps the external
  // Cineplexx CTA rendered here after it was removed from the dashboard teaser.
  assert.doesNotMatch(source, /viewAllHref/u);
  assert.match(card, /const cineplexxProgrammeUrl = "https:\/\/www\.cineplexx\.me\//u);
  assert.match(
    card,
    /\{!viewAllHref && \(displayState === "programme" \|\| displayState === "stale"\)/u,
  );
});

// The <title> already carried the city; the visible H1 was the bare word "Filmovi" while every
// sibling module page ("Događaji u Podgorici", "Plaže u Baru…") named its city.
test("gives the cinema H1 the same registry-derived locative as the title", async () => {
  const source = await readFile(new URL("./page.tsx", import.meta.url), "utf8");
  const podgorica = getCity("podgorica");
  assert.ok(podgorica);

  assert.match(source, /const cityName = getCityName\(context\.city, "locative"\);/u);
  assert.match(source, /title=\{`Filmovi u \$\{cityName\}`\}/u);
  assert.doesNotMatch(source, /title="Filmovi"/u);
  assert.equal(`Filmovi u ${getCityName(podgorica, "locative")}`, "Filmovi u Podgorici");
});

test("the H1 change leaves title, description and canonical exactly as they were", async () => {
  const source = await readFile(new URL("./page.tsx", import.meta.url), "utf8");
  const podgorica = getCity("podgorica");
  assert.ok(podgorica);

  assert.equal(
    getPageTitle(`Filmovi u ${getCityName(podgorica, "locative")}`),
    "Filmovi u Podgorici | Gradom.me",
  );
  assert.match(
    source,
    /const description = `Aktuelni Cineplexx repertoar u \$\{cityName\}: filmovi i termini projekcija\.`;/u,
  );
  assert.match(source, /canonical: getCinemaPath\(context\.city\),/u);
  // Internal linking and provider wiring are untouched by this pass.
  assert.match(source, /<CineplexxProgrammeCard events=\{screenings\} locale=\{locale\}/u);
});
