import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  getRepresentativeMapPoint,
  getSeaWaterQualityMapUrl,
} from "./sea-water-quality-map-point.ts";

// Shapes captured from the live JPMD response. Velika Plaža 01 and 02 are adjacent official
// measurement zones on one beach — the case that must never collapse to a single map target.
const velikaPlaza01 = "POLYGON ((19.2436066035853 41.9084257385294, 19.2432884999473 41.9075564674321, 19.2424619340759 41.9077280134668, 19.2436066035853 41.9084257385294))";
const velikaPlaza02 = "POLYGON ((19.2468734 41.9065873, 19.2470001 41.9060002, 19.2465003 41.9061004, 19.2468734 41.9065873))";

const pageSource = async () =>
  readFile(new URL("./sea-water-quality-location-page.tsx", import.meta.url), "utf8");

test("reads WKT longitude-first and returns the polygon's own first vertex", () => {
  const point = getRepresentativeMapPoint(velikaPlaza01);

  // Reversing the pair would put a Montenegrin zone near Somalia, so both are pinned.
  assert.deepEqual(point, { latitude: 41.9084257385294, longitude: 19.2436066035853 });
  assert.ok(point && point.latitude > 41 && point.latitude < 43, "latitude must be Montenegrin");
  assert.ok(point && point.longitude > 18 && point.longitude < 20, "longitude must be Montenegrin");
});

test("the point lies on the official polygon, not averaged out of it", () => {
  const point = getRepresentativeMapPoint(velikaPlaza01);
  assert.ok(point);

  // It is literally the first coordinate pair of the source polygon.
  assert.match(velikaPlaza01, new RegExp(`\\(\\(${point.longitude} ${point.latitude}`, "u"));
});

test("builds a keyless Google Maps coordinate URL", () => {
  const url = getSeaWaterQualityMapUrl(velikaPlaza01);
  assert.ok(url);

  const parsed = new URL(url);
  assert.equal(parsed.origin + parsed.pathname, "https://www.google.com/maps/search/");
  assert.equal(parsed.searchParams.get("api"), "1");
  assert.equal(parsed.searchParams.get("query"), "41.9084257385294,19.2436066035853");
  // No key, no tracking, no analytics parameters.
  assert.deepEqual([...parsed.searchParams.keys()].sort(), ["api", "query"]);
});

test("adjacent measurement zones get different map targets", () => {
  const first = getSeaWaterQualityMapUrl(velikaPlaza01);
  const second = getSeaWaterQualityMapUrl(velikaPlaza02);

  assert.ok(first && second);
  assert.notEqual(first, second);
});

test("fails closed on anything that is not a well-formed POLYGON", () => {
  for (const geometry of [
    undefined,
    "",
    "   ",
    "POINT (19.24 41.90)",
    "MULTIPOLYGON (((19.24 41.90, 19.25 41.91, 19.24 41.90)))",
    "LINESTRING (19.24 41.90, 19.25 41.91)",
    "POLYGON (())",
    "POLYGON ((abc def))",
    "POLYGON ((19.24))",
    "not geometry at all",
  ]) {
    assert.equal(getRepresentativeMapPoint(geometry), undefined, String(geometry));
    assert.equal(getSeaWaterQualityMapUrl(geometry), undefined, String(geometry));
  }
});

test("rejects coordinates outside the possible range", () => {
  assert.equal(getRepresentativeMapPoint("POLYGON ((19.24 91.0, 19.25 41.9))"), undefined);
  assert.equal(getRepresentativeMapPoint("POLYGON ((181.0 41.9, 19.25 41.9))"), undefined);
  assert.equal(getRepresentativeMapPoint("POLYGON ((-181.0 41.9, 19.25 41.9))"), undefined);
  assert.equal(getRepresentativeMapPoint("POLYGON ((19.24 -91.0, 19.25 41.9))"), undefined);
});

test("never reads the null point fields JPMD publishes", async () => {
  const source = await readFile(new URL("./sea-water-quality-map-point.ts", import.meta.url), "utf8");

  // gSirina/gDuzina are null in every JPMD record; using them would render nothing, forever.
  assert.doesNotMatch(source, /gSirina|gDuzina/u, "except where named in the explanatory comment");
});

test("the CTA renders only with a usable map point, from this location's own geometry", async () => {
  const source = await pageSource();

  assert.match(source, /getSeaWaterQualityMapUrl\(location\.officialGeometry\)/u);
  assert.match(source, /\{mapUrl \? \(/u);
  // A sibling's geometry can never reach the link: only `location` is consulted.
  assert.doesNotMatch(source, /getSeaWaterQualityMapUrl\((?!location\.officialGeometry)/u);
});

test("the CTA copy claims a zone, never an exact sampling location", async () => {
  const source = await pageSource();

  assert.match(source, /Zona mjernog mjesta na mapi/u);
  assert.match(source, /aria-label="Otvori zonu mjernog mjesta na mapi"/u);
  for (const overclaim of [/Mjerno mjesto na mapi/u, /Tačna lokacija/iu, /Lokacija plaže/iu]) {
    assert.doesNotMatch(source, overclaim, String(overclaim));
  }
});

test("the external link is safe, crawlable and undecorated", async () => {
  const source = await pageSource();

  assert.match(source, /target="_blank"/u);
  assert.match(source, /rel="noopener noreferrer"/u);
  assert.doesNotMatch(source, /nofollow/u);
  // Icon decorative; the visible text carries the meaning.
  assert.match(source, /<MapPin aria-hidden="true"/u);
});

test("placement and advertising order are unchanged", async () => {
  const source = await pageSource();
  const at = (needle: string) => source.indexOf(needle, source.indexOf("return ("));

  // Latest result -> map CTA -> summary -> advertising -> history -> siblings.
  assert.ok(at("najnoviji-rezultat-heading") < at("Zona mjernog mjesta na mapi"));
  assert.ok(at("Zona mjernog mjesta na mapi") < at("sazetak-mjerenja-heading"));
  assert.ok(at("sazetak-mjerenja-heading") < at("<AdvertisingCard"));
  assert.ok(at("<AdvertisingCard") < at("Druga mjerna mjesta"));
});

test("no structured data or metadata was touched by this feature", async () => {
  const source = await pageSource();
  const route = await readFile(
    new URL("../../../app/[city]/plaze/[slug]/page.tsx", import.meta.url),
    "utf8",
  );

  // The derived point is a navigation affordance only.
  assert.doesNotMatch(source, /GeoCoordinates|"latitude"|"longitude"/u);
  assert.doesNotMatch(route, /google\.com\/maps|GeoCoordinates/u);
  assert.match(route, /createSeaWaterQualityLocationBreadcrumbStructuredData/u);
});
