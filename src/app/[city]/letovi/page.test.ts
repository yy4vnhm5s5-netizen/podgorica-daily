import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { isFlightsSupportedCityId } from "@/modules/flights/infrastructure/podgorica-flights";
import { getActiveCities, getCity, getCityName } from "@/shared/config/cities";
import { getPageTitle } from "@/shared/config/site";

// The title was "Letovi Podgorica" — a bare label with the city in the nominative. "iz" governs
// the genitive, which the registry now carries, so the full phrase is finally expressible.
test("the flights title uses the registry genitive, never the nominative", async () => {
  const source = await readFile(new URL("./page.tsx", import.meta.url), "utf8");

  assert.match(source, /function getFlightsPageTitle\(cityName: string\)/u);
  assert.match(source, /return `Letovi iz \$\{cityName\}`;/u);
  assert.match(
    source,
    /const title = getFlightsPageTitle\(getCityName\(context\.city, "genitive"\)\);/u,
  );
  assert.doesNotMatch(source, /getFlightsPageTitle\(context\.city\.name\)/u);
  assert.doesNotMatch(source, /"Podgorice"/u, "the form must come from the registry");
});

test("the title formula produces exactly 'Letovi iz Podgorice | Gradom.me'", () => {
  const podgorica = getCity("podgorica");
  assert.ok(podgorica);

  assert.equal(
    getPageTitle(`Letovi iz ${getCityName(podgorica, "genitive")}`),
    "Letovi iz Podgorice | Gradom.me",
  );
});

test("every flights-capable city would get its own genitive, not a hardcoded one", () => {
  for (const city of getActiveCities().filter((candidate) =>
    isFlightsSupportedCityId(candidate.id),
  )) {
    const title = `Letovi iz ${getCityName(city, "genitive")}`;

    assert.doesNotMatch(title, new RegExp(`iz ${city.name}$`, "u"), city.id);
    assert.equal(title, `Letovi iz ${city.genitiveName ?? city.name}`, city.id);
  }
});

test("the flights description keeps its already-correct accusative", () => {
  const podgorica = getCity("podgorica");
  assert.ok(podgorica);

  // "za" governs the accusative — this was never wrong and is unchanged.
  assert.equal(
    `Dolasci i odlasci za ${getCityName(podgorica, "accusative")} iz zvaničnih podataka aerodroma.`,
    "Dolasci i odlasci za Podgoricu iz zvaničnih podataka aerodroma.",
  );
});

test("the flights page H1 (in airport-flights-page.tsx) was not touched by the title fix", async () => {
  const source = await readFile(
    new URL("../../../modules/flights/presentation/airport-flights-page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /<SectionTitle as="h1" id="flights-heading" title=\{copy\.title\} \/>/u);
  assert.match(source, /title: "Aerodrom Podgorica",/u);
});

test("Tivat still has no verified airport code, so it gets neither the flights capability nor a flights page", () => {
  const tivat = getCity("tivat");
  assert.ok(tivat);

  assert.equal(tivat.capabilities?.includes("flights"), false);
  assert.equal(isFlightsSupportedCityId("tivat"), false);
});
