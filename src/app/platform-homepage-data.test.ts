import assert from "node:assert/strict";
import test from "node:test";

import {
  createPlatformCityCardData,
  createPlatformHomepageStructuredData,
  getPlatformHomepageMetadata,
} from "./platform-homepage-data.ts";
import { getActiveCities, getCity } from "@/shared/config/cities";

test("derives generic city cards from every active registry city", () => {
  const cards = getActiveCities().map((city) => createPlatformCityCardData(city, null));

  assert.deepEqual(
    cards.map((card) => card.city.id),
    ["budva", "podgorica"],
  );
  const budva = cards.find((card) => card.city.id === "budva");
  assert.ok(budva);
  assert.deepEqual(
    budva.shortcuts.map((shortcut) => shortcut.label),
    ["Izlasci", "Struja"],
  );
  assert.deepEqual(
    budva.highlights.map((highlight) => highlight.key),
    ["weather", "going-out"],
  );
  assert.deepEqual(
    cards.find((card) => card.city.id === "podgorica")?.shortcuts.map((shortcut) => shortcut.label),
    ["Događaji", "Izlasci", "Letovi", "Struja"],
  );
  assert.deepEqual(
    cards
      .find((card) => card.city.id === "podgorica")
      ?.highlights.map((highlight) => highlight.key),
    ["weather", "events", "going-out", "flights"],
  );
  assert.equal(getCity("budva")?.isActive, true);
});

test("creates platform metadata and structured data only from public city cards", () => {
  const cities = getActiveCities();
  const structuredData = createPlatformHomepageStructuredData([
    ...cities.map((city) => createPlatformCityCardData(city, null)),
  ]);
  const metadata = getPlatformHomepageMetadata();
  const graph = structuredData["@graph"];

  assert.equal(metadata.alternates?.canonical, "/");
  assert.equal(metadata.openGraph?.url, "/");
  assert.match(JSON.stringify(metadata.twitter), /summary_large_image/u);
  assert.equal(graph[0]?.["@type"], "WebSite");
  assert.equal(graph[1]?.["@type"], "ItemList");
  assert.deepEqual(graph[1]?.itemListElement, [
    {
      "@type": "ListItem",
      name: "Budva",
      position: 1,
      url: "https://gradom.me/budva",
    },
    {
      "@type": "ListItem",
      name: "Podgorica",
      position: 2,
      url: "https://gradom.me/podgorica",
    },
  ]);
  assert.equal(JSON.stringify(structuredData).includes("budva"), true);
});
