import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { isFlightsSupportedCityId } from "@/modules/flights/infrastructure/podgorica-flights";
import { airportFlightsSources } from "@/modules/flights/infrastructure/airport-flights-config";
import { getCity } from "@/shared/config/cities";
import { getCitySitemapPaths } from "@/app/city-routing";
import { getFlightsPath } from "@/shared/config/public-routes";
import { getPageTitle } from "@/shared/config/site";

const flightsCopy = async () =>
  readFile(
    new URL("../../../modules/flights/presentation/airport-flights-page.tsx", import.meta.url),
    "utf8",
  );

const requireCity = (cityId: "podgorica" | "tivat") => {
  const city = getCity(cityId);
  assert.ok(city);
  return city;
};

test("the document title names the airport and accurate timetable concept", () => {
  const titles = [
    getPageTitle(
      `Red letenja za ${airportFlightsSources.podgorica.displayName} — dolasci i odlasci`,
    ),
    getPageTitle(`Red letenja za ${airportFlightsSources.tivat.displayName} — dolasci i odlasci`),
  ];

  assert.deepEqual(titles, [
    "Red letenja za Aerodrom Podgorica — dolasci i odlasci | Gradom.me",
    "Red letenja za Aerodrom Tivat — dolasci i odlasci | Gradom.me",
  ]);

  for (const title of titles) {
    assert.match(title, /Red letenja/u);
    assert.match(title, /dolasci/iu);
    assert.match(title, /odlasci/iu);
    // A title, not a keyword list: one subject and one qualifier, no pipe-separated variants.
    assert.equal(title.split("|").length, 2, title);
    assert.ok(title.length <= 70, `title is ${title.length} characters`);
  }
});

test("the title and page H1 use the configured airport source", async () => {
  const source = await flightsCopy();
  assert.match(source, /const title = airport\.displayName/u);
  assert.match(source, /title=\{title\}/u);
  assert.match(source, /<FlightsCityDiscovery city=\{city\} \/>/u);
  assert.equal(airportFlightsSources.tivat.displayName, "Aerodrom Tivat");
});

test("the intro copy states both flight directions and the real source", async () => {
  const source = await flightsCopy();
  assert.match(source, /Aktuelni red letenja za \$\{airportName\}/u);
  assert.match(source, /dolasci i odlasci/u);
  assert.match(source, /Aerodroma Crne Gore/u);
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
  const podgorica = requireCity("podgorica");
  const paths = getCitySitemapPaths(podgorica);

  assert.equal(getFlightsPath(podgorica), "/podgorica/letovi");
  assert.equal(paths.filter((path) => path === "/podgorica/letovi").length, 1);
  // Nothing keyword-shaped was added alongside it.
  for (const alias of ["/podgorica/aerodrom", "/podgorica/dolasci", "/podgorica/red-letenja"]) {
    assert.equal(paths.includes(alias), false, alias);
  }
});

test("Tivat has a verified airport source, flights capability and one canonical page", () => {
  const tivat = requireCity("tivat");

  assert.equal(tivat.capabilities?.includes("flights"), true);
  assert.equal(isFlightsSupportedCityId("tivat"), true);
  assert.equal(getFlightsPath(tivat), "/tivat/letovi");
  assert.equal(getCitySitemapPaths(tivat).filter((path) => path === "/tivat/letovi").length, 1);
});

test("Tivat route metadata derives airport identity and canonical URL from shared configuration", async () => {
  const route = await readFile(new URL("./page.tsx", import.meta.url), "utf8");

  assert.match(route, /getAirportFlightsSourceForCity\(context\.city\.id\)/u);
  assert.match(route, /getFlightsPageTitle\(airport\.displayName\)/u);
  assert.match(route, /Red letenja za \$\{airportName\} — dolasci i odlasci/u);
  assert.match(route, /Red letenja za \$\{airport\.displayName\}/u);
  assert.match(route, /canonical: getFlightsPath\(context\.city\)/u);
});
