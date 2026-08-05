import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { getPowerOutagesTranslations } from "@/modules/city-alerts/presentation/power-outages-translations";
import { getActiveCities, getCityName } from "@/shared/config/cities";
import { getCitySitemapPaths, isCityPublicFeatureRouteAvailable } from "@/app/city-routing";
import { getElectricityPath } from "@/shared/config/public-routes";
import { getPageTitle } from "@/shared/config/site";

const routeSource = async () => readFile(new URL("./page.tsx", import.meta.url), "utf8");

const electricityCities = () =>
  getActiveCities().filter((city) => isCityPublicFeatureRouteAvailable(city, "electricity"));

test("every electricity city gets its own locative from the registry", () => {
  const cities = electricityCities();
  assert.ok(cities.length > 0);

  for (const city of cities) {
    const { title } = getPowerOutagesTranslations("me", city);
    const locative = getCityName(city, "locative");

    assert.equal(title, `Planirana isključenja struje u ${locative}`, city.id);
    // Tivat -> "Tivtu" is irregular, so a nominative here would be a real grammar bug.
    assert.doesNotMatch(title, new RegExp(`u ${city.name}$`, "u"), city.id);
  }
});

test("the metadata is the page's own copy, not a second weaker restatement", async () => {
  const source = await routeSource();

  // One dictionary feeds the document title, the H1 and the description, so a SERP snippet can
  // never say less than the page it describes.
  assert.match(source, /getPowerOutagesTranslations\("me", context\.city\)/u);
  assert.doesNotMatch(source, /const description = `/u);
});

test("the title and description say planned outages, and name the source", () => {
  const { description, title } = getPowerOutagesTranslations("me", getTivat());
  const documentTitle = getPageTitle(title);

  assert.match(title, /Planirana isključenja struje/u);
  assert.match(description, /planirana isključenja struje/iu);
  assert.match(description, /CEDIS/u);
  // Not a keyword list, and short enough to survive a SERP.
  assert.equal(documentTitle.split("|").length, 2, documentTitle);
  assert.ok(documentTitle.length <= 70, `title is ${documentTitle.length} characters`);
});

test("no copy implies live grid status or complete outage coverage", () => {
  const { description, empty, emptyTitle, title } = getPowerOutagesTranslations("me", getTivat());
  const copy = [description, empty, emptyTitle, title].join(" ");

  const forbidden = [/\buživo\b/iu, /u\s+realnom\s+vremenu/iu, /nestank\w*/iu, /nema\s+struje/iu];
  for (const pattern of forbidden) {
    assert.doesNotMatch(copy, pattern, String(pattern));
  }
  // The empty state is scoped to announced planned works, never to whether the power is on.
  assert.equal(empty, "Bez planiranih isključenja struje u Tivtu.");
});

test("a successful empty result stays distinct from an unavailable provider", async () => {
  const source = await readFile(
    new URL("../../../modules/city-alerts/presentation/power-outages-page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /result\.status === "unavailable" \?/u);
  assert.match(source, /result\.status === "empty" \?/u);
  // Absence is only claimed alongside the collector's verified last successful read.
  assert.match(source, /result\.lastSuccessfulUpdate \?/u);
  assert.match(source, /\{translations\.checkedAt\}/u);
  assert.match(source, /\{translations\.stale\}/u);
  // The publication-time label stays gone.
  assert.doesNotMatch(source, /Objavljeno|publishedAt/u);
});

test("one canonical URL per electricity city, with no alias route", () => {
  for (const city of electricityCities()) {
    const canonical = getElectricityPath(city);
    const paths = getCitySitemapPaths(city);

    assert.equal(canonical, `/${city.slug}/struja`, city.id);
    assert.equal(paths.filter((path) => path === canonical).length, 1, city.id);
    for (const alias of [`/${city.slug}/struja/danas`, `/${city.slug}/nestanak-struje`]) {
      assert.equal(paths.includes(alias), false, alias);
    }
  }
});

test("the canonical stays self-referencing and no structured data was added", async () => {
  const source = await routeSource();

  assert.match(source, /canonical: getElectricityPath\(context\.city\)/u);
  assert.doesNotMatch(source, /ld\+json/u);
});

function getTivat() {
  const tivat = getActiveCities().find((city) => city.id === "tivat");
  assert.ok(tivat);
  return tivat;
}
