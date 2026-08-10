import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { getCity } from "@/shared/config/cities";
import {
  getCityFeatureDiscovery,
  getCityFeatureDiscoveryDesktopColumns,
} from "./city-feature-discovery-model.ts";
import type { City } from "@/shared/types/city";

function requireCity(cityId: "bar" | "budva" | "kotor" | "podgorica" | "tivat" | "ulcinj"): City {
  const city = getCity(cityId);
  if (!city) throw new Error(`Expected ${cityId} in the city registry.`);
  return city;
}

const allFeaturesEnabled = { isFeatureEnabled: () => true };

test("preserves the approved Flights destination sets through the shared model", () => {
  const podgorica = getCityFeatureDiscovery(
    requireCity("podgorica"),
    "flights",
    allFeaturesEnabled,
  );
  const tivat = getCityFeatureDiscovery(requireCity("tivat"), "flights", allFeaturesEnabled);

  assert.equal(podgorica.heading, "Još iz Podgorice");
  assert.deepEqual(
    podgorica.links.map(({ href, key, label }) => ({ href, key, label })),
    [
      { href: "/podgorica/dogadjaji", key: "events", label: "Događaji" },
      { href: "/podgorica/izlasci", key: "goingOut", label: "Izlasci" },
      { href: "/podgorica/struja", key: "electricity", label: "Struja" },
    ],
  );
  assert.deepEqual(
    tivat.links.map(({ href, key, label }) => ({ href, key, label })),
    [
      { href: "/tivat/dogadjaji", key: "events", label: "Događaji" },
      { href: "/tivat/izlasci", key: "goingOut", label: "Izlasci" },
      { href: "/tivat/plaze", key: "seaWaterQuality", label: "Plaže" },
      { href: "/tivat/struja", key: "electricity", label: "Struja" },
    ],
  );
});

test("derives Electricity discovery from public same-city capabilities", () => {
  const expected = {
    bar: ["goingOut", "seaWaterQuality"],
    budva: ["goingOut", "seaWaterQuality"],
    kotor: ["goingOut", "seaWaterQuality"],
    podgorica: ["events", "goingOut", "flights"],
    tivat: ["events", "goingOut", "seaWaterQuality", "flights"],
    ulcinj: ["goingOut", "seaWaterQuality"],
  } as const;

  for (const [cityId, keys] of Object.entries(expected) as readonly [
    keyof typeof expected,
    readonly string[],
  ][]) {
    const discovery = getCityFeatureDiscovery(
      requireCity(cityId),
      "electricity",
      allFeaturesEnabled,
    );

    assert.equal(discovery.heading, `Još iz ${getGenitive(cityId)}`, cityId);
    assert.deepEqual(
      discovery.links.map(({ key }) => key),
      keys,
      cityId,
    );
    assert.equal(
      discovery.links.some(({ key }) => key === "electricity"),
      false,
      cityId,
    );
    assert.ok(
      discovery.links.every(({ href }) => href.startsWith(`/${cityId}/`)),
      `${cityId} must only link within its own canonical city route space`,
    );
  }
});

test("derives Going Out discovery from public same-city capabilities", () => {
  const expected = {
    bar: ["seaWaterQuality", "electricity"],
    budva: ["seaWaterQuality", "electricity"],
    kotor: ["seaWaterQuality", "electricity"],
    podgorica: ["events", "electricity", "flights"],
    tivat: ["events", "seaWaterQuality", "electricity", "flights"],
    ulcinj: ["seaWaterQuality", "electricity"],
  } as const;

  for (const [cityId, keys] of Object.entries(expected) as readonly [
    keyof typeof expected,
    readonly string[],
  ][]) {
    const discovery = getCityFeatureDiscovery(requireCity(cityId), "goingOut", allFeaturesEnabled);

    assert.equal(discovery.heading, `Još iz ${getGenitive(cityId)}`, cityId);
    assert.deepEqual(
      discovery.links.map(({ key }) => key),
      keys,
      cityId,
    );
    assert.equal(
      discovery.links.some(({ key }) => key === "goingOut"),
      false,
      cityId,
    );
    assert.ok(
      discovery.links.every(({ href }) => href.startsWith(`/${cityId}/`)),
      `${cityId} must only link within its own canonical city route space`,
    );
  }
});

test("uses public feature availability and never fabricates unavailable destinations", () => {
  const discovery = getCityFeatureDiscovery(requireCity("tivat"), "electricity", {
    isFeatureEnabled: (feature) => feature !== "goingOut" && feature !== "seaWaterQuality",
  });

  assert.deepEqual(
    discovery.links.map(({ key }) => key),
    ["events", "flights"],
  );
  assert.equal(
    discovery.links.some(({ href }) => href === "/tivat/struja"),
    false,
  );
  assert.equal(
    discovery.links.some(({ href }) => href === "/tivat"),
    false,
  );
});

test("derives desktop grid width from destination count, never a city name", () => {
  assert.equal(getCityFeatureDiscoveryDesktopColumns(1), "lg:grid-cols-1");
  assert.equal(getCityFeatureDiscoveryDesktopColumns(2), "lg:grid-cols-2");
  assert.equal(getCityFeatureDiscoveryDesktopColumns(3), "lg:grid-cols-3");
  assert.equal(getCityFeatureDiscoveryDesktopColumns(4), "lg:grid-cols-4");
  assert.equal(getCityFeatureDiscoveryDesktopColumns(5), "lg:grid-cols-4");
});

test("keeps destination selection generic rather than branching on city identity", async () => {
  const source = await readFile(
    new URL("./city-feature-discovery-model.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /getExploreCityLinks\(city/u);
  assert.doesNotMatch(source, /city\.(?:id|slug|name)/u);
  assert.doesNotMatch(source, /podgorica|tivat|budva|kotor|bar|ulcinj/u);
});

function getGenitive(cityId: keyof typeof cityGenitives) {
  return cityGenitives[cityId];
}

const cityGenitives = {
  bar: "Bara",
  budva: "Budve",
  kotor: "Kotora",
  podgorica: "Podgorice",
  tivat: "Tivta",
  ulcinj: "Ulcinja",
} as const;
