import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { getActiveCities, getCity } from "@/shared/config/cities";
import { getCityPath, getFuelPricesPath } from "@/shared/config/public-routes";

const read = async (file: string) => readFile(new URL(file, import.meta.url), "utf8");

test("every active city has a description a crawler can read, from the registry", async () => {
  const index = await read("./platform-city-index.tsx");

  // The list is generated from the registry and prints the registry's own sentence — nothing is
  // written for search engines, and nothing is hidden.
  assert.match(index, /getActiveCities\(\)/u);
  assert.match(index, /\{city\.description\}/u);
  assert.match(index, /href=\{getCityPath\(city\)\}/u);
  for (const city of getActiveCities()) {
    assert.equal(typeof city.description, "string", `${city.id} must carry a description`);
  }
});

test("the inactive city is absent, because the registry says it is inactive", () => {
  const cityIds = getActiveCities().map(({ id }) => id);

  assert.equal(cityIds.includes("niksic"), false);
  assert.equal(getCity("niksic")?.isActive, false);
  // Six today, but the assertion is the rule, not the count.
  assert.equal(
    cityIds.every((id) => getCity(id)?.isActive === true),
    true,
  );
});

test("each active city home URL is a real anchor target", () => {
  for (const city of getActiveCities()) {
    assert.equal(getCityPath(city), `/${city.slug}`);
  }
});

test("the city tabs are real links, so crawlers and no-JS visitors reach the city", async () => {
  const selector = await read("./platform-city-selector.tsx");

  // Progressive enhancement: an anchor to the city page that a normal click upgrades to a tab
  // switch. Modifier clicks are left alone so open-in-new-tab keeps working.
  assert.match(selector, /href=\{card\.href\}/u);
  const modifierGuard =
    /event\.metaKey \|\| event\.altKey \|\| event\.ctrlKey \|\| event\.shiftKey/u;
  assert.match(selector, modifierGuard);
  assert.match(selector, /role="tab"/u);
  assert.match(selector, /aria-selected=\{isSelected\}/u);
});

test("no second set of dashboard panels is rendered for search engines", async () => {
  const index = await read("./platform-city-index.tsx");

  // The index is config only: no metrics, no cache reads, no hidden duplicate of the rich panel.
  assert.doesNotMatch(index, /highlights|shortcuts|loadCityDashboardData|CityCard/u);
  assert.doesNotMatch(index, /sr-only|hidden|display:\s*none|aria-hidden="true"/u);
});

test("the fuel teaser links through the route helper and shows no prices", async () => {
  const homepage = await read("./platform-homepage.tsx");

  assert.match(homepage, /href=\{getFuelPricesPath\(\)\}/u);
  assert.doesNotMatch(homepage, /href="\/gorivo"/u);
  assert.equal(getFuelPricesPath(), "/gorivo");
  assert.match(homepage, /Cijene goriva u Crnoj Gori/u);
  assert.match(homepage, /Pogledaj cijene goriva/u);
  // A teaser, not a second dashboard: no figures, no products, no dates.
  assert.doesNotMatch(homepage, /Eurosuper|Eurodizel|Lož ulje|€ \/ L|formatFuelPrice/u);
});

test("the fuel teaser sits between the city block and the supporting content", async () => {
  const homepage = await read("./platform-homepage.tsx");
  const order = [...homepage.matchAll(/aria-labelledby="([a-z-]+)"/gu)].map(([, id]) => id);

  assert.deepEqual(order, [
    "platform-homepage-title",
    "cities-heading",
    "fuel-heading",
    "how-it-works-heading",
    "faq-heading",
  ]);
});

test("the homepage additions stay server-rendered", async () => {
  const homepage = await read("./platform-homepage.tsx");
  const index = await read("./platform-city-index.tsx");

  // The selector remains the page's only client boundary.
  assert.doesNotMatch(homepage, /"use client"/u);
  assert.doesNotMatch(index, /"use client"/u);
});

test("the last-city continuation is still wired into the city block", async () => {
  const homepage = await read("./platform-homepage.tsx");

  assert.match(homepage, /<LastCityContinuation cards=\{cards\} \/>/u);
});
