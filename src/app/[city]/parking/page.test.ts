import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { getCitySitemapPaths, isCityPublicFeatureRouteAvailable } from "@/app/city-routing";
import { getCity } from "@/shared/config/cities";
import { getParkingPath } from "@/shared/config/public-routes";
import { getPageTitle } from "@/shared/config/site";

async function routeSource() {
  return readFile(new URL("./page.tsx", import.meta.url), "utf8");
}

async function pageSource() {
  return readFile(
    new URL("../../../modules/parking/presentation/parking-page.tsx", import.meta.url),
    "utf8",
  );
}

test("exposes one Podgorica-only Parking route through the shared capability and feature gate", () => {
  const podgorica = getCity("podgorica");
  const budva = getCity("budva");
  assert.ok(podgorica);
  assert.ok(budva);

  assert.equal(getParkingPath(podgorica), "/podgorica/parking");
  assert.equal(
    getCitySitemapPaths(podgorica, { isFeatureEnabled: () => true }).includes("/podgorica/parking"),
    true,
  );
  assert.equal(
    getCitySitemapPaths(budva, { isFeatureEnabled: () => true }).includes("/budva/parking"),
    false,
  );
  assert.equal(
    isCityPublicFeatureRouteAvailable(podgorica, "parking", { isFeatureEnabled: () => true }),
    true,
  );
  assert.equal(
    isCityPublicFeatureRouteAvailable(budva, "parking", { isFeatureEnabled: () => true }),
    false,
  );
  assert.equal(
    isCityPublicFeatureRouteAvailable(podgorica, "parking", { isFeatureEnabled: () => false }),
    false,
  );
});

test("uses the exact Parking metadata title and self-canonical route", async () => {
  const source = await routeSource();

  assert.equal(
    getPageTitle("Parking Podgorica — slobodna parking mjesta"),
    "Parking Podgorica — slobodna parking mjesta | Gradom.me",
  );
  assert.match(source, /canonical: getParkingPath\(context\.city\)/u);
  assert.match(source, /Parking Podgorica — slobodna parking mjesta/u);
  assert.match(source, /Parking u Podgorici/u);
});

test("keeps the public Parking route cache-only and distinguishes current, last-reported and unavailable availability", async () => {
  const route = await routeSource();
  const page = await pageSource();

  assert.match(route, /getParkingAvailability\(\)/u);
  assert.doesNotMatch(route, /fetch\(/u);
  assert.doesNotMatch(page, /fetch\(/u);
  assert.match(page, /Broj slobodnih mjesta trenutno nije dostupan\./u);
  assert.match(page, /Posljednje prijavljeno/u);
  assert.match(page, /Izvorni podatak/u);
  assert.match(page, /availability\.state === "fresh"/u);
  assert.match(page, /availability\.state === "stale"/u);
  assert.match(page, /slobodnih mjesta/u);
  assert.match(page, /Parking servis Podgorica/u);
  assert.match(page, /currentFeature="parking"/u);
  assert.doesNotMatch(page, /ExploreCityLinks/u);
});
