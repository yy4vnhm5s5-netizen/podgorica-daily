import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// The locations list is a .tsx server component; the project's convention for asserting
// presentation structure is to read the source and assert on it (see
// sea-water-quality-location-page.test.ts and sea-water-quality-card.test.ts).
async function pageSource() {
  return readFile(new URL("./sea-water-quality-page.tsx", import.meta.url), "utf8");
}

test("explains that beach names open detail pages, keeping the table heading", async () => {
  const source = await pageSource();

  assert.match(source, /Kliknite na ime plaže za detaljne informacije/u);
  assert.match(source, /Sva kupališta/u);
});

test("presents the instruction as a subtle italic helper note rather than a heading", async () => {
  const source = await pageSource();
  const helper = source.match(/<p className="([^"]*)">\s*Kliknite na ime plaže za detaljne/u);

  assert.ok(helper, "expected the helper note to be rendered as a <p>");
  assert.match(helper[1], /\bitalic\b/u);
  assert.match(helper[1], /text-muted-foreground/u);
  assert.match(helper[1], /text-xs/u);
});

test("marks linked locations with a right arrow inside the same link as the name", async () => {
  const source = await pageSource();
  const link = source.match(/<Link[\s\S]*?<\/Link>/u);

  assert.ok(link, "expected a location Link in the beach table");
  assert.match(link[0], /<ArrowRight/u);
  assert.match(link[0], /\{location\.name\}/u);
  // The arrow must precede the name so it renders to its left.
  assert.ok(
    link[0].indexOf("<ArrowRight") < link[0].indexOf("{location.name}"),
    "the arrow must come before the location name",
  );
  assert.match(source, /import \{ ArrowRight, Waves \} from "lucide-react";/u);
});

test("keeps the arrow compact and decorative so the table does not grow wider", async () => {
  const source = await pageSource();

  assert.match(source, /className="size-3\.5 shrink-0 text-muted-foreground"/u);
  assert.match(source, /aria-hidden="true"/u);
  assert.match(source, /inline-flex items-center gap-1/u);
  // The horizontal budget for the first column is unchanged.
  assert.match(source, /min-w-\[32rem\]/u);
});

test("leaves locations without a detail route as plain text with no arrow", async () => {
  const source = await pageSource();
  const conditional = source.match(/\{locationSlug \? \([\s\S]*?\) : \(\s*location\.name\s*\)\}/u);

  assert.ok(conditional, "expected the linked/unlinked conditional to remain");
  // The whole arrow + Link branch stays inside the `locationSlug ?` truthy branch.
  const [truthyBranch] = conditional[0].split(") : (");
  assert.match(truthyBranch, /<ArrowRight/u);
  assert.equal(conditional[0].split("<ArrowRight").length - 1, 1);
});

test("preserves the existing detail-link behaviour and accessible focus state", async () => {
  const source = await pageSource();

  assert.match(source, /href=\{getSeaWaterQualityLocationPath\(city, locationSlug\)\}/u);
  assert.match(source, /const locationSlug = locationSlugs\?\.get\(location\.id\);/u);
  assert.match(source, /focus-visible:ring-2 focus-visible:ring-primary/u);
  assert.doesNotMatch(source, /onClick/u);
  assert.doesNotMatch(source, /router\.push/u);
});

test("adds the shared city discovery after the listing source without a data dependency", async () => {
  const source = await pageSource();

  assert.match(
    source,
    /import \{ CityFeatureDiscovery \} from "@\/shared\/components\/city-feature-discovery";/u,
  );
  assert.match(source, /<CityFeatureDiscovery city=\{city\} currentFeature="seaWaterQuality" \/>/u);
  assert.doesNotMatch(source, /ExploreCityLinks/u);
  assert.ok(
    source.indexOf("https://monitoring.morskodobro.me") < source.indexOf("<CityFeatureDiscovery"),
  );
  for (const banned of [/"use client"/u, /fetch\(/u, /jpmd-client|backfill/iu]) {
    assert.doesNotMatch(source, banned, String(banned));
  }
});
