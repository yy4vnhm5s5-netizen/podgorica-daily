import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { getCity, getCityName } from "@/shared/config/cities";

test("events page title and H1 are built per-city, not from the shared Podgorica-only heading string", async () => {
  const source = await readFile(new URL("./page.tsx", import.meta.url), "utf8");

  // The page must not read eventTranslations.heading (a single hardcoded "Događaji u
  // Podgorici" string shared with HomepageEventsCard's dashboard-card heading) — it must
  // build its own heading from the resolved city instead.
  assert.doesNotMatch(source, /title=\{eventTranslations\.heading\}/u);
  assert.doesNotMatch(source, /getPageTitle\(translations\.heading\)/u);
  assert.match(source, /function getEventsPageHeading\(cityName: string\)/u);
  assert.match(source, /`Događaji u \$\{cityName\}`/u);
  assert.match(source, /getEventsPageHeading\(getCityName\(context\.city, "locative"\)\)/u);
  // Used for both the metadata title and both the success/error-path H1s.
  assert.equal(
    (source.match(/getEventsPageHeading\(getCityName\(context\.city, "locative"\)\)/gu) ?? [])
      .length,
    2,
  );
  assert.equal((source.match(/title=\{heading\}/gu) ?? []).length, 2);
});

test("the per-city heading formula produces the exact required strings for Tivat and Podgorica", () => {
  const getEventsPageHeading = (cityName: string) => `Događaji u ${cityName}`;

  const tivat = getCity("tivat");
  const podgorica = getCity("podgorica");
  assert.ok(tivat);
  assert.ok(podgorica);

  assert.equal(getEventsPageHeading(getCityName(tivat, "locative")), "Događaji u Tivtu");
  assert.equal(getEventsPageHeading(getCityName(podgorica, "locative")), "Događaji u Podgorici");
});

test("the metadata description is built per-city, not the shared Podgorica-only supportingText", async () => {
  const source = await readFile(new URL("./page.tsx", import.meta.url), "utf8");

  assert.doesNotMatch(source, /description: translations\.supportingText,/u);
  assert.match(source, /description: getEventsPageDescription\(context\.city\),/u);
});

test("the description describes dated listings from official sources, and uses the registry", async () => {
  const source = await readFile(new URL("./page.tsx", import.meta.url), "utf8");

  // Pinned against the implementation, not a copy of it: the one template, interpolating the
  // registry locative rather than any hand-written city form.
  assert.match(source, /const cityName = getCityName\(city, "locative"\);/u);
  assert.match(source, /Predstojeći događaji i dešavanja u \$\{cityName\}, grupisani po danima/u);
  assert.match(source, /iz zvaničnih izvora, sa filterima za danas, sjutra i ovaj vikend\./u);
  // Offering a "danas" filter is not a claim that anything is on today.
  assert.doesNotMatch(source, /svi\s+događaji|kompletan\s+kalendar|\buživo\b/iu);

  // Tivat's irregular locative must survive, and it must not inherit Podgorica's adjective.
  const tivat = getCity("tivat");
  assert.ok(tivat);
  assert.equal(getCityName(tivat, "locative"), "Tivtu");
  assert.doesNotMatch(source, /podgoričkih/u);
});

test("Budva still has no events route, so its events page and metadata remain a 404 and untouched", () => {
  const budva = getCity("budva");
  assert.ok(budva);
  assert.equal(budva.capabilities?.includes("events"), false);
});

test("the day heading marks today in the city timezone, without replacing the date", async () => {
  const source = await readFile(
    new URL("../../../modules/events/presentation/events-list.tsx", import.meta.url),
    "utf8",
  );

  // Resolved with the same helper and timezone groupEventsByDay uses, so the marker cannot label
  // a different day than the group it sits on, and it is request time (revalidate = 0).
  assert.match(source, /date === getLocalDate\(now, timeZone\)/u);
  assert.match(source, /formatDayHeading\(group\.date, locale, timezone\)/u);
  // The marker is a prefix on the full date, never a replacement for it.
  assert.match(source, /"Danas" : "Today"\} — \$\{label\}/u);
  // No route was added for the intent.
  assert.doesNotMatch(source, /\/danas/u);
});

test("uses shared city discovery after Events content without a duplicate neutral block", async () => {
  const source = await readFile(new URL("./page.tsx", import.meta.url), "utf8");

  assert.match(
    source,
    /import \{ CityFeatureDiscovery \} from "@\/shared\/components\/city-feature-discovery";/u,
  );
  assert.match(source, /<CityFeatureDiscovery city=\{context\.city\} currentFeature="events" \/>/u);
  assert.doesNotMatch(source, /ExploreCityLinks/u);
  assert.ok(
    source.indexOf('<CityFeatureDiscovery city={context.city} currentFeature="events" />') >
      source.indexOf("<EventsList"),
  );
});
