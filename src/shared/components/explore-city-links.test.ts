import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// This component is a .tsx server component; the project's convention for asserting presentation
// structure is to read the source and assert on it (see sea-water-quality-location-page.test.ts).
// The behavioural rules it depends on — which destinations a city gets — are covered by real unit
// tests in src/shared/config/explore-city-links.test.ts.
async function componentSource() {
  return readFile(new URL("./explore-city-links.tsx", import.meta.url), "utf8");
}

test("renders crawlable anchors rather than script-driven navigation", async () => {
  const source = await componentSource();

  assert.match(source, /import Link from "next\/link";/u);
  assert.match(source, /href=\{link\.href\}/u);
  assert.match(source, /\{link\.label\}/u);
  assert.doesNotMatch(source, /onClick/u);
  assert.doesNotMatch(source, /router\.push/u);
  assert.doesNotMatch(source, /<button/u);
});

test("exposes the block as a labelled navigation landmark", async () => {
  const source = await componentSource();

  assert.match(source, /<nav\b/u);
  assert.match(source, /aria-labelledby=\{headingId\}/u);
  assert.match(source, /<h2[\s\S]*?id=\{headingId\}/u);
  assert.match(source, /focus-visible:ring-2/u);
});

test("derives destinations from city capabilities instead of hardcoding a city", async () => {
  const source = await componentSource();

  assert.match(source, /getExploreCityLinks\(city, \{ exclude, limit \}\)/u);
  assert.match(source, /getCityName\(city, "locative"\)/u);
  // No literal city name/grammatical form may be baked into the shared component.
  assert.doesNotMatch(source, /Budv|Podgoric|Tivt|Kotor|Baru/u);
});

test("collapses instead of rendering an empty block", async () => {
  const source = await componentSource();

  assert.match(source, /if \(links\.length === 0\) return null;/u);
});

test("wraps responsively without route-specific layout branches", async () => {
  const source = await componentSource();

  assert.match(source, /flex flex-wrap gap-2/u);
  // A shared component must not special-case the page it happens to be rendered on.
  assert.doesNotMatch(source, /usePathname|pathname|plaze|izlasci|dogadjaji|struja/u);
});
