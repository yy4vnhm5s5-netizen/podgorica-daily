import assert from "node:assert/strict";
import test from "node:test";

import { getActiveCities, getCity } from "./cities.ts";
import { getExploreCityLinks } from "./explore-city-links.ts";
import type { Feature } from "./features.ts";
import type { City } from "@/shared/types/city";

// Feature flags are environment-driven, so every assertion injects an explicit resolver instead of
// depending on whatever the ambient env happens to enable.
const allFeaturesEnabled = { isFeatureEnabled: () => true };

function requireCity(cityId: string): City {
  const city = getCity(cityId);
  if (!city) throw new Error(`expected "${cityId}" in the city registry`);
  return city;
}

test("derives same-city destinations with real routes and locative city grammar", () => {
  const links = getExploreCityLinks(requireCity("budva"), {
    exclude: ["seaWaterQuality"],
    ...allFeaturesEnabled,
  });

  assert.deepEqual(links, [
    { href: "/budva/izlasci", key: "goingOut", label: "Izlasci u Budvi" },
    { href: "/budva/struja", key: "electricity", label: "Struja u Budvi" },
    { href: "/budva", key: "city", label: "Sve informacije za Budvu" },
  ]);
});

test("never offers a destination the city does not support", () => {
  // Bar supports electricity, goingOut, seaWaterQuality and weather — but not events, flights,
  // railway or water.
  const links = getExploreCityLinks(requireCity("bar"), { limit: 10, ...allFeaturesEnabled });
  const hrefs = links.map((link) => link.href);

  assert.deepEqual(hrefs, ["/bar/izlasci", "/bar/plaze", "/bar/struja", "/bar"]);
  assert.equal(hrefs.includes("/bar/dogadjaji"), false);
  assert.equal(hrefs.includes("/bar/letovi"), false);
  assert.equal(hrefs.includes("/bar/filmovi"), false);
});

test("excludes the feature the current page already is", () => {
  const bar = requireCity("bar");
  const onBeachDetail = getExploreCityLinks(bar, {
    exclude: ["seaWaterQuality"],
    limit: 10,
    ...allFeaturesEnabled,
  });
  const onGoingOut = getExploreCityLinks(bar, {
    exclude: ["goingOut"],
    limit: 10,
    ...allFeaturesEnabled,
  });

  assert.equal(onBeachDetail.some((link) => link.key === "seaWaterQuality"), false);
  assert.equal(onGoingOut.some((link) => link.key === "goingOut"), false);
  // Excluding one destination must not drop the others.
  assert.equal(onBeachDetail.some((link) => link.key === "goingOut"), true);
  assert.equal(onGoingOut.some((link) => link.key === "seaWaterQuality"), true);
});

test("respects globally disabled features", () => {
  const disabled: Feature[] = ["goingOut", "seaWaterQuality"];
  const links = getExploreCityLinks(requireCity("bar"), {
    isFeatureEnabled: (feature) => !disabled.includes(feature),
    limit: 10,
  });

  assert.deepEqual(links.map((link) => link.key), ["electricity", "city"]);
});

test("returns at most three destinations by default, highest value first", () => {
  const links = getExploreCityLinks(requireCity("podgorica"), {
    exclude: ["goingOut"],
    ...allFeaturesEnabled,
  });

  assert.equal(links.length, 3);
  assert.deepEqual(links.map((link) => link.key), ["events", "electricity", "flights"]);
  assert.equal(links[0].href, "/podgorica/dogadjaji");
});

test("honours an explicit limit", () => {
  const podgorica = requireCity("podgorica");

  assert.equal(getExploreCityLinks(podgorica, { limit: 1, ...allFeaturesEnabled }).length, 1);
  assert.deepEqual(getExploreCityLinks(podgorica, { limit: 0, ...allFeaturesEnabled }), []);
});

test("uses each city's own grammatical forms rather than a hardcoded city", () => {
  function labelsFor(cityId: string) {
    const links = getExploreCityLinks(requireCity(cityId), { limit: 10, ...allFeaturesEnabled });
    return links.map((link) => link.label);
  }

  assert.ok(labelsFor("podgorica").includes("Događaji u Podgorici"));
  assert.ok(labelsFor("tivat").includes("Izlasci u Tivtu"));
  assert.ok(labelsFor("kotor").includes("Plaže u Kotoru"));
  assert.ok(labelsFor("bar").includes("Struja u Baru"));
  assert.ok(labelsFor("bar").includes("Sve informacije za Bar"));
});

test("every derived link is a crawlable same-city path with anchor text", () => {
  // Registry-driven: a newly activated city is covered without editing this list.
  for (const city of getActiveCities()) {
    const cityId = city.id;

    for (const link of getExploreCityLinks(city, { limit: 10, ...allFeaturesEnabled })) {
      assert.ok(link.href.length > 0, `${cityId}/${link.key} must have an href`);
      assert.ok(
        link.href === `/${city.slug}` || link.href.startsWith(`/${city.slug}/`),
        `${link.href} must stay inside /${city.slug}`,
      );
      assert.ok(link.label.trim().length > 0, `${cityId}/${link.key} must have anchor text`);
    }
  }
});

test("returns nothing for an inactive city", () => {
  const inactive = requireCity("niksic");

  assert.equal(inactive.isActive, false);
  assert.deepEqual(getExploreCityLinks(inactive, { limit: 10, ...allFeaturesEnabled }), []);
});
