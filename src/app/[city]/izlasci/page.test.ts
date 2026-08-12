import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { getActiveCities, getCityName } from "@/shared/config/cities";
import { getCitySitemapPaths, isCityPublicFeatureRouteAvailable } from "@/app/city-routing";
import { getGoingOutPath } from "@/shared/config/public-routes";
import { getPageTitle } from "@/shared/config/site";

const routeSource = async () => readFile(new URL("./page.tsx", import.meta.url), "utf8");
const pageSource = async () =>
  readFile(
    new URL("../../../modules/going-out/presentation/going-out-page.tsx", import.meta.url),
    "utf8",
  );
const sectionSource = async () =>
  readFile(
    new URL("../../../modules/going-out/presentation/going-out-section.tsx", import.meta.url),
    "utf8",
  );

const goingOutCities = () =>
  getActiveCities().filter((city) => isCityPublicFeatureRouteAvailable(city, "goingOut"));

test("every supported city gets its own locative in the title and description", () => {
  const cities = goingOutCities();
  assert.ok(cities.length > 0);

  for (const city of cities) {
    const locative = getCityName(city, "locative");
    const title = `Izlasci i dešavanja u ${locative}`;

    // The locative comes from the registry, so no city grammar is written by hand.
    assert.notEqual(locative, "", city.id);
    assert.match(title, new RegExp(`u ${locative}$`, "u"), city.id);
    assert.doesNotMatch(title, new RegExp(`u ${city.name}$`, "u"), city.id);
  }
});

test("the title states the subject without becoming a keyword list", () => {
  const title = getPageTitle("Izlasci i dešavanja u Podgorici");

  assert.match(title, /Izlasci/u);
  assert.match(title, /dešavanja/u);
  // One subject, then the site name — not a pipe-separated list of query variants.
  assert.equal(title.split("|").length, 2, title);
  assert.ok(title.length <= 70, `title is ${title.length} characters`);
});

test("no copy names a field the listing model does not carry", async () => {
  // A listing has a title, a day, and optionally a start time and a venue. Nothing else.
  const source = `${await routeSource()}\n${await pageSource()}`;

  for (const forbidden of [
    /DJ\s+večeri/iu,
    /\bžurk/iu,
    /noćni\s+život/iu,
    /\bulaznic/iu,
    /\bcijena\b/iu,
    /\borganizator/iu,
    /najbolj/iu,
    /preporuč/iu,
  ]) {
    assert.doesNotMatch(source, forbidden, String(forbidden));
  }
});

test("no copy claims to cover everything happening in the city", async () => {
  const source = `${await routeSource()}\n${await pageSource()}`;

  assert.doesNotMatch(source, /sve\s+što\s+se\s+dešava/iu);
  assert.doesNotMatch(source, /svi\s+događaji/iu);
  assert.doesNotMatch(source, /na\s+jednom\s+mjestu/iu);
});

test("keeps provider and filter-specific empty states distinct from claims about city nightlife", async () => {
  const source = await pageSource();

  assert.match(source, /empty: "Trenutno nemamo dostupne najave izlazaka u \{city\}\."/u);
  assert.match(source, /Danas nema najavljenih izlazaka\./u);
  assert.match(source, /Sjutra nema najavljenih izlazaka\./u);
  assert.match(source, /Za ovaj vikend nema najavljenih izlazaka\./u);
  // The filter text is about the retained announcements, never the city's real-world nightlife.
  assert.doesNotMatch(source, /nema izlazaka/iu);
  // Provider failure stays a separate, distinguishable state.
  assert.match(source, /displayState === "unavailable"/u);
});

test("one canonical URL per supported city, with no alias or date route", () => {
  for (const city of goingOutCities()) {
    const canonical = getGoingOutPath(city);
    const paths = getCitySitemapPaths(city);

    assert.equal(canonical, `/${city.slug}/izlasci`, city.id);
    assert.equal(paths.filter((path) => path === canonical).length, 1, city.id);
    for (const alias of [
      `/${city.slug}/izlasci/danas`,
      `/${city.slug}/desavanja`,
      `/${city.slug}/zurke`,
    ]) {
      assert.equal(paths.includes(alias), false, alias);
    }
  }
});

test("the canonical stays self-referencing and no structured data was added", async () => {
  const route = await routeSource();

  assert.match(route, /canonical: getGoingOutPath\(context\.city\)/u);
  assert.doesNotMatch(route, /ld\+json/u);
  assert.doesNotMatch(await pageSource(), /ld\+json|schema\.org/u);
});

test("uses the established server-rendered period query without changing canonical metadata", async () => {
  const route = await routeSource();

  assert.match(route, /searchParams: Promise<Record<string, string \| string\[\] \| undefined>>/u);
  assert.match(route, /parseGoingOutUiFilters\(await searchParams\)/u);
  assert.match(route, /filters=\{filters\}/u);
  assert.match(route, /async function generateMetadata\(\{ params \}: GoingOutRouteProps\)/u);
  assert.doesNotMatch(route, /fetch\(/u);
});

test("keeps date filters and their empty state on the listing, never a Going Out detail page", async () => {
  const listing = await pageSource();
  const detail = await readFile(new URL("./[eventKey]/page.tsx", import.meta.url), "utf8");

  assert.match(
    listing,
    /<GoingOutQuickFilters city=\{city\} filters=\{filters\} locale=\{locale\} \/>/u,
  );
  assert.match(listing, /period=\$\{preset\}/u);
  assert.match(listing, /aria-current=\{isCurrent \? "page" : undefined\}/u);
  assert.match(listing, /copy\.filterEmptyTitle\[filters\.datePreset\]/u);
  assert.match(listing, /snapshotDisplayState === "stale"/u);
  assert.match(listing, /<CityFeatureDiscovery city=\{city\} currentFeature="goingOut" \/>/u);
  assert.doesNotMatch(
    detail,
    /GoingOutQuickFilters|parseGoingOutUiFilters|filterGoingOutPageEvents/u,
  );
});

test("does not render listing enrichment fields before a dedicated UI phase", async () => {
  const presentation = `${await pageSource()}\n${await sectionSource()}`;

  for (const field of [
    "address",
    "description",
    "eventType",
    "genre",
    "informationUrl",
    "isFree",
    "organizer",
    "performers",
    "priceLabel",
  ]) {
    assert.doesNotMatch(presentation, new RegExp(`event\\.${field}`, "u"), field);
  }
});
