import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { getActiveCities, getCity } from "@/shared/config/cities";
import { getCityPath } from "@/shared/config/public-routes";

const source = async () =>
  readFile(new URL("./platform-city-discovery.tsx", import.meta.url), "utf8");

test("the city list stays registry-driven, with nothing hardcoded for layout", async () => {
  const discovery = await source();

  assert.match(discovery, /getActiveCities\(\)/u);
  assert.match(discovery, /href=\{getCityPath\(city\)\}/u);
  // No city name is written into the component for any reason, layout included. Comments that
  // mention a city while explaining the layout are prose, not a hardcoded value.
  const code = discovery.replace(/\/\/[^\n]*|\{\/\*[\s\S]*?\*\/\}/gu, "");
  for (const city of getActiveCities()) {
    assert.doesNotMatch(code, new RegExp(`"${city.name}"`, "u"));
  }
});

test("every active city is represented, and the inactive one is not", () => {
  const cityIds = getActiveCities().map(({ id }) => id);

  assert.equal(cityIds.includes("niksic"), false);
  assert.equal(getCity("niksic")?.isActive, false);
  assert.equal(
    cityIds.every((id) => getCity(id)?.isActive === true),
    true,
  );
  for (const city of getActiveCities()) assert.equal(getCityPath(city), `/${city.slug}`);
});

test("the grid is two columns on mobile and three from the large breakpoint", async () => {
  const discovery = await source();

  const [, gridClasses] = /<ul className="([^"]*)">/u.exec(discovery) ?? [];
  assert.ok(gridClasses, "the list must carry its own grid classes");
  assert.match(gridClasses, /\bgrid\b/u);
  // Two columns unprefixed, so mobile and tablet both show 2 × 3.
  assert.match(gridClasses, /(?<![a-z:])grid-cols-2/u);
  assert.match(gridClasses, /lg:grid-cols-3/u);
  // The old single-column default is gone, and no intermediate override reintroduces it.
  assert.doesNotMatch(gridClasses, /sm:grid-cols-2/u);
  assert.doesNotMatch(gridClasses, /grid-cols-1/u);
});

test("nothing scrolls sideways and no viewport logic is involved", async () => {
  const discovery = await source();

  assert.doesNotMatch(discovery, /overflow-x|snap-x|flex-nowrap|min-w-max/u);
  assert.doesNotMatch(discovery, /useState|useEffect|matchMedia|innerWidth/u);
});

test("the link keeps its touch height while the mobile padding tightens", async () => {
  const discovery = await source();

  const [, linkClasses] = /<Link\s+className="([^"]*)"/u.exec(discovery) ?? [];
  assert.ok(linkClasses);
  // Horizontal padding and icon gap shrink on mobile only; vertical padding is untouched.
  assert.match(linkClasses, /\bpy-3\b/u);
  assert.match(linkClasses, /\bpx-2\.5\b/u);
  assert.match(linkClasses, /\bsm:px-3\b/u);
  // Names must never be cut off to make two columns fit.
  assert.doesNotMatch(linkClasses, /truncate|text-ellipsis|line-clamp/u);
});

test("the section stays server-rendered", async () => {
  assert.doesNotMatch(await source(), /"use client"/u);
});
