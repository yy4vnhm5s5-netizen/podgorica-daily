import assert from "node:assert/strict";
import test from "node:test";

import { getCity } from "@/shared/config/cities";
import {
  getFlightsCityDiscovery,
  getFlightsCityDiscoveryDesktopColumns,
} from "./flights-city-discovery-model.ts";
import type { City } from "@/shared/types/city";

function requireCity(cityId: "bar" | "podgorica" | "tivat"): City {
  const city = getCity(cityId);
  if (!city) throw new Error(`Expected ${cityId} in the city registry.`);
  return city;
}

const allFeaturesEnabled = { isFeatureEnabled: () => true };

test("derives Podgorica Flights discovery from shared public city routes", () => {
  const discovery = getFlightsCityDiscovery(requireCity("podgorica"), allFeaturesEnabled);

  assert.equal(discovery.heading, "Još iz Podgorice");
  assert.deepEqual(discovery.links, [
    {
      description: "Događaji i najave",
      href: "/podgorica/dogadjaji",
      key: "events",
      label: "Događaji",
      navigationLabel: "Događaji u Podgorici",
    },
    {
      description: "Izlasci i nastupi",
      href: "/podgorica/izlasci",
      key: "goingOut",
      label: "Izlasci",
      navigationLabel: "Izlasci u Podgorici",
    },
    {
      description: "Servisne informacije",
      href: "/podgorica/struja",
      key: "electricity",
      label: "Struja",
      navigationLabel: "Struja u Podgorici",
    },
  ]);
});

test("derives Tivat Flights discovery without a city-specific branch", () => {
  const discovery = getFlightsCityDiscovery(requireCity("tivat"), allFeaturesEnabled);

  assert.equal(discovery.heading, "Još iz Tivta");
  assert.deepEqual(
    discovery.links.map(({ href, key, label }) => ({ href, key, label })),
    [
      { href: "/tivat/dogadjaji", key: "events", label: "Događaji" },
      { href: "/tivat/izlasci", key: "goingOut", label: "Izlasci" },
      { href: "/tivat/plaze", key: "seaWaterQuality", label: "Plaže" },
      { href: "/tivat/struja", key: "electricity", label: "Struja" },
    ],
  );
});

test("omits unavailable public features and never links back to Flights or the city hub", () => {
  const discovery = getFlightsCityDiscovery(requireCity("tivat"), {
    isFeatureEnabled: (feature) => feature !== "goingOut" && feature !== "seaWaterQuality",
  });

  assert.deepEqual(
    discovery.links.map(({ key }) => key),
    ["events", "electricity"],
  );
  assert.equal(
    discovery.links.some(({ href }) => href === "/tivat/letovi"),
    false,
  );
  assert.equal(
    discovery.links.some(({ href }) => href === "/tivat"),
    false,
  );
});

test("degrades cleanly for a city with fewer public capabilities", () => {
  const discovery = getFlightsCityDiscovery(requireCity("bar"), allFeaturesEnabled);

  assert.equal(discovery.heading, "Još iz Bara");
  assert.deepEqual(
    discovery.links.map(({ key }) => key),
    ["goingOut", "seaWaterQuality", "electricity"],
  );
});

test("derives desktop grid width from the number of destinations, never a city name", () => {
  assert.equal(getFlightsCityDiscoveryDesktopColumns(1), "lg:grid-cols-1");
  assert.equal(getFlightsCityDiscoveryDesktopColumns(2), "lg:grid-cols-2");
  assert.equal(getFlightsCityDiscoveryDesktopColumns(3), "lg:grid-cols-3");
  assert.equal(getFlightsCityDiscoveryDesktopColumns(4), "lg:grid-cols-4");
  assert.equal(getFlightsCityDiscoveryDesktopColumns(5), "lg:grid-cols-4");
});
