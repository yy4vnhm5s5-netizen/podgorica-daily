import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { getCineplexxProgrammeTranslations } from "./cineplexx-programme-translations.ts";
import { getActiveCities } from "@/shared/config/cities";
import { getCinemaPath } from "@/shared/config/public-routes";
import { isCityCinemaRouteAvailable } from "@/app/city-routing";

async function readCardSource() {
  return readFile(new URL("./cineplexx-programme-card.tsx", import.meta.url), "utf8");
}

test("renders the internal listing link as a plain crawlable Link, not a JS handler", async () => {
  const source = await readCardSource();

  assert.match(source, /import Link from "next\/link";/u);
  assert.match(source, /<Link\n\s+className="[^"]*"\n\s+href=\{viewAllHref\}\n\s+>/u);
  assert.doesNotMatch(source, /onClick|router\.push|useRouter/u);
});

test("keeps the internal link outside the display-state branches so it survives an empty day", async () => {
  const source = await readCardSource();
  // The external CTA is still gated on there being a programme; the internal one is not, so
  // /[city]/filmovi stays reachable when the provider is empty or unavailable.
  assert.match(source, /\{viewAllHref \? \(\n\s+<Link/u);
  assert.match(
    source,
    /\{displayState === "programme" \|\| displayState === "stale" \? \(\n\s+<a/u,
  );
});

test("omits the link entirely when no href is supplied, so /filmovi never self-links", async () => {
  const source = await readCardSource();
  const cinemaPage = await readFile(
    new URL("../../../app/[city]/filmovi/page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /viewAllHref\?: string;/u);
  // The listing page renders the same card without the prop.
  assert.match(cinemaPage, /<CineplexxProgrammeCard events=\{screenings\} locale=\{locale\}/u);
  assert.doesNotMatch(cinemaPage, /viewAllHref/u);
});

test("labels the link in both locales without naming a city", () => {
  assert.equal(getCineplexxProgrammeTranslations("me").viewAll, "Svi filmovi");
  assert.equal(getCineplexxProgrammeTranslations("en").viewAll, "All movies");
});

test("only cinema-capable cities have a /filmovi target for the link to point at", () => {
  const withCinema = getActiveCities().filter((city) => isCityCinemaRouteAvailable(city));
  const withoutCinema = getActiveCities().filter((city) => !isCityCinemaRouteAvailable(city));

  // Cineplexx covers Podgorica only today; the rule is provider support, not a hardcoded city.
  assert.deepEqual(
    withCinema.map((city) => getCinemaPath(city)),
    ["/podgorica/filmovi"],
  );
  assert.equal(withoutCinema.length > 0, true);
  for (const city of withoutCinema) {
    assert.equal(isCityCinemaRouteAvailable(city), false, city.id);
  }
});

test("the card itself hardcodes no city path", async () => {
  const source = await readCardSource();

  // Every href in the card is an expression — no literal string href exists, so the route can
  // only ever arrive as a prop. (Asserted this way rather than by grepping for "/filmovi", which
  // also appears in the prose of the doc comment.)
  assert.doesNotMatch(source, /href="/u);
  assert.doesNotMatch(source, /getCinemaPath/u);
  assert.doesNotMatch(source, /podgorica"/u);
});
