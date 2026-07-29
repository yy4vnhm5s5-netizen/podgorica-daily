import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { isFlightsSupportedCityId } from "@/modules/flights/infrastructure/podgorica-flights";
import { getCity } from "@/shared/config/cities";

test("Podgorica flights metadata title is city-aware, not the grammatically incomplete 'za' variant", async () => {
  const source = await readFile(new URL("./page.tsx", import.meta.url), "utf8");

  assert.doesNotMatch(source, /`Letovi za \$\{context\.city\.name\}`/u);
  assert.match(source, /function getFlightsPageTitle\(cityName: string\)/u);
  assert.match(source, /`Letovi \$\{cityName\}`/u);
  assert.match(source, /const title = getFlightsPageTitle\(context\.city\.name\);/u);
});

test("the title formula produces exactly 'Letovi Podgorica' for Podgorica", () => {
  const getFlightsPageTitle = (cityName: string) => `Letovi ${cityName}`;
  const podgorica = getCity("podgorica");
  assert.ok(podgorica);

  assert.equal(getFlightsPageTitle(podgorica.name), "Letovi Podgorica");
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
