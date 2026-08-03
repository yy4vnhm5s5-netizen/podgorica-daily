import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("renders user-facing beach history without exposing the raw JPMD source round", async () => {
  const source = await readFile(
    new URL("./sea-water-quality-location-page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /Kvalitet vode/u);
  assert.match(source, /Datum uzorkovanja/u);
  assert.match(source, /measurement\.samplingDateTime \?\? measurement\.samplingDate \?\? "—"/u);
  assert.doesNotMatch(source, />\s*Krug monitoringa\s*</u);
  assert.doesNotMatch(source, /\{measurement\.sourceRound\}<\/td>/u);
});

test("offers contextual same-city navigation without linking back to the beach listing", async () => {
  const source = await readFile(
    new URL("./sea-water-quality-location-page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(
    source,
    /import \{ ExploreCityLinks \} from "@\/shared\/components\/explore-city-links";/u,
  );
  assert.match(source, /<ExploreCityLinks city=\{city\} exclude=\{\["seaWaterQuality"\]\} \/>/u);
});

test("renders the visible breadcrumb from the same trail as the structured data", async () => {
  const source = await readFile(
    new URL("./sea-water-quality-location-page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /getSeaWaterQualityLocationBreadcrumbTrail\(\{/u);
  assert.match(source, /<nav aria-label="Putanja"/u);
  assert.match(source, /aria-current="page"/u);
  // Non-terminal crumbs must be crawlable links, not plain text.
  assert.match(source, /href=\{step\.href\}/u);
  assert.doesNotMatch(source, /onClick/u);
});

test("shows the wider JPMD beach name as secondary context without touching the H1", async () => {
  const source = await readFile(
    new URL("./sea-water-quality-location-page.tsx", import.meta.url),
    "utf8",
  );

  // H1 still identifies the monitoring location this canonical URL represents.
  assert.match(
    source,
    /title=\{`\$\{location\.displayName\}, \$\{city\.name\} — kvalitet mora`\}/u,
  );
  assert.match(source, /const beachName = getDistinctBeachName\(location\);/u);
  assert.match(source, /\{beachName \? \(/u);
  assert.match(source, /Plaža: /u);
});

test("uses the compact linked JPMD source attribution", async () => {
  const source = await readFile(
    new URL("./sea-water-quality-location-page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /<p className="text-sm italic text-muted-foreground">/u);
  assert.match(source, /Izvor:/u);
  assert.match(source, />\s*JPMD\s*</u);
  assert.match(source, /href=\{sourceUrl\}/u);
  assert.match(source, /rel="noopener noreferrer"/u);
  assert.match(source, /target="_blank"/u);
});
