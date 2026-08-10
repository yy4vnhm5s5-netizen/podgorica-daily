import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { getActiveCities } from "@/shared/config/cities";
import { getExploreCityLinks } from "@/shared/config/explore-city-links";
import { getCityPath } from "@/shared/config/public-routes";

// Which public route families render the shared contextual-navigation block, and with which
// feature excluded. Each entry is the file that owns that route's rendered body.
const rollout = [
  {
    exclude: "seaWaterQuality",
    file: "src/modules/sea-water-quality/presentation/sea-water-quality-location-page.tsx",
    route: "/[city]/plaze/[slug]",
  },
] as const;

// Repository root, resolved from this file rather than the working directory.
const repositoryRoot = new URL("../../", import.meta.url);

async function readSource(path: string) {
  return readFile(new URL(path, repositoryRoot), "utf8");
}

test("every rolled-out route renders the shared block excluding its own feature", async () => {
  for (const { exclude, file, route } of rollout) {
    const source = await readSource(file);

    assert.match(
      source,
      /import \{ ExploreCityLinks \} from "@\/shared\/components\/explore-city-links";/u,
      `${route} must import the shared component`,
    );
    assert.match(
      source,
      new RegExp(`<ExploreCityLinks[^>]*exclude=\\{\\["${exclude}"\\]\\}`, "u"),
      `${route} must exclude its own feature`,
    );
  }
});

test("no rolled-out route reimplements link selection or hardcodes a city", async () => {
  for (const { file, route } of rollout) {
    const source = await readSource(file);

    // Destination choice stays in the shared model — routes only pass city + exclude.
    assert.doesNotMatch(source, /getExploreCityLinks/u, `${route} must not select links itself`);
    assert.doesNotMatch(
      source,
      /exploreCityLinkDefinitions|defaultExploreCityLinkLimit/u,
      `${route} must not reach into the shared model internals`,
    );
    assert.doesNotMatch(
      source,
      /<ExploreCityLinks[^>]*\blimit=/u,
      `${route} must not raise the shared limit`,
    );
  }
});

test("the block is not added to the city dashboard, which already lists every module", async () => {
  const dashboard = await readSource("src/app/city-dashboard.tsx");

  assert.doesNotMatch(dashboard, /ExploreCityLinks/u);
});

test("each rolled-out route excludes a key the shared model actually knows", () => {
  // A typo'd exclude would silently do nothing and let a page link back to itself, so every
  // excluded key must be one the model can actually emit for some active city.
  const emittableKeys = new Set(
    getActiveCities().flatMap((city) =>
      getExploreCityLinks(city, { isFeatureEnabled: () => true, limit: Infinity }).map(
        ({ key }) => key,
      ),
    ),
  );

  for (const { exclude, route } of rollout) {
    assert.ok(emittableKeys.has(exclude), `${route} excludes an unknown key: ${exclude}`);
  }
});

test("rolled-out routes only ever offer supported same-city destinations", () => {
  // The routes delegate entirely, so the guarantee is the model's: for every active city, every
  // destination it would emit is a supported route inside that same city.
  for (const city of getActiveCities()) {
    for (const { exclude } of rollout) {
      for (const link of getExploreCityLinks(city, { exclude: [exclude] })) {
        assert.notEqual(link.key, exclude);
        assert.ok(
          link.href === getCityPath(city) || link.href.startsWith(`${getCityPath(city)}/`),
          `${city.id} was offered an out-of-city destination: ${link.href}`,
        );
      }
    }
  }
});
