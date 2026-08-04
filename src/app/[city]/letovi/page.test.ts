import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { isFlightsSupportedCityId } from "@/modules/flights/infrastructure/podgorica-flights";
import { podgoricaAirportName } from "@/modules/flights/presentation/airport-flights-page";
import { getCity } from "@/shared/config/cities";
import { getCitySitemapPaths } from "@/app/city-routing";
import { getFlightsPath } from "@/shared/config/public-routes";
import { getPageTitle } from "@/shared/config/site";

const flightsCopy = async () =>
  readFile(
    new URL("../../../modules/flights/presentation/airport-flights-page.tsx", import.meta.url),
    "utf8",
  );

const requirePodgorica = () => {
  const podgorica = getCity("podgorica");
  assert.ok(podgorica);
  return podgorica;
};

test("the document title names the airport the page is about", () => {
  // Search demand reaching this page is "aerodrom podgorica" and its variants; a title describing
  // the city instead ("Letovi iz Podgorice") never contained the word at all.
  const title = getPageTitle(`${podgoricaAirportName} — dolasci i odlasci`);

  assert.match(title, /Aerodrom Podgorica/u);
  assert.match(title, /dolasci/iu);
  assert.match(title, /odlasci/iu);
  // A title, not a keyword list: one subject and one qualifier, no pipe-separated variants.
  assert.equal(title.split("|").length, 2, title);
  assert.ok(title.length <= 70, `title is ${title.length} characters`);
});

test("the title and the page H1 name the same airport", async () => {
  // They are generated in different layers, so they are single-sourced from one constant.
  assert.equal(podgoricaAirportName, "Aerodrom Podgorica");
  assert.match(await flightsCopy(), /title: podgoricaAirportName,/u);
});

test("the intro copy states both flight directions and the real source", async () => {
  const source = await flightsCopy();
  const description = /description:\s*\n?\s*"([^"]+Aerodrom Podgorica[^"]+)"/u.exec(source)?.[1];
  assert.ok(description, "the Montenegrin intro sentence must exist");

  assert.match(description, /red letenja/iu);
  assert.match(description, /dolasci/iu);
  assert.match(description, /odlasci/iu);
  assert.match(description, /Aerodroma Crne Gore/u);
});

test("no copy claims data the feed does not carry", async () => {
  // The feed supplies destination, IATA flight number, scheduled time and a status id — there is
  // no airline, estimated or actual time, gate, delay or cancellation field, so nothing may be
  // described as live or real-time either.
  const source = await flightsCopy();

  for (const forbidden of [
    /\buživo\b/iu,
    /u\s+realnom\s+vremenu/iu,
    /real[-\s]?time/iu,
    /\bkašnjenj/iu,
    /\botkazan/iu,
    /\bgejt\b/iu,
    /\bterminal\b/iu,
  ]) {
    assert.doesNotMatch(source, forbidden, String(forbidden));
  }
});

test("one canonical flights URL, with no alias or doorway route", () => {
  const podgorica = requirePodgorica();
  const paths = getCitySitemapPaths(podgorica);

  assert.equal(getFlightsPath(podgorica), "/podgorica/letovi");
  assert.equal(paths.filter((path) => path === "/podgorica/letovi").length, 1);
  // Nothing keyword-shaped was added alongside it.
  for (const alias of ["/podgorica/aerodrom", "/podgorica/dolasci", "/podgorica/red-letenja"]) {
    assert.equal(paths.includes(alias), false, alias);
  }
});

test("Tivat still has no verified airport code, so it gets neither the capability nor a page", () => {
  const tivat = getCity("tivat");
  assert.ok(tivat);

  assert.equal(tivat.capabilities?.includes("flights"), false);
  assert.equal(isFlightsSupportedCityId("tivat"), false);
});
