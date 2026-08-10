import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("renders source-backed details without inventing optional facts", async () => {
  const source = await readFile(new URL("./going-out-detail.tsx", import.meta.url), "utf8");

  assert.match(source, /as="h1"/u);
  assert.match(source, /title=\{event\.title\}/u);
  assert.match(source, /label="Datum i vrijeme"/u);
  assert.match(source, /label="Mjesto" value=\{event\.venue\}/u);
  assert.match(source, /label="Adresa" value=\{event\.address\}/u);
  assert.match(source, /label="Izvođači"/u);
  assert.match(source, /label="Organizator" value=\{event\.organizer\}/u);
  assert.match(source, /event\.isFree \? "Besplatan ulaz" : event\.priceLabel/u);
  assert.match(source, /Više informacija/u);
  assert.match(source, /Izvor:/u);
  assert.match(source, />\s*MonteGigs\s*</u);
  assert.match(source, /if \(!value\) return null;/u);
  assert.doesNotMatch(source, /cijena u eurima|dostupne ulaznice|dostupnost ulaznica/iu);
});

test("uses the shared breadcrumb trail for crawlable navigation and keeps source links safe", async () => {
  const source = await readFile(new URL("./going-out-detail.tsx", import.meta.url), "utf8");

  assert.match(source, /getGoingOutDetailBreadcrumbTrail\(city, event\)/u);
  assert.match(source, /aria-current="page"/u);
  assert.match(source, /href=\{event\.informationUrl\}/u);
  assert.match(source, /href=\{event\.sourceUrl\}/u);
  assert.match(source, /rel="noreferrer"/u);
  assert.match(source, /target="_blank"/u);
  assert.match(source, /<NewTabNotice locale=\{locale\} \/>/u);
});
