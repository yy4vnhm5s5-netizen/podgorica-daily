import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { isCityPublicFeatureRouteAvailable } from "@/app/city-routing";
import { getActiveCities, getCityName } from "@/shared/config/cities";
import { getPageTitle } from "@/shared/config/site";

const seaWaterCities = () =>
  getActiveCities().filter((city) => isCityPublicFeatureRouteAvailable(city, "seaWaterQuality"));

// Regression test for the production titles "Plaže Bar i kvalitet mora" etc., where the city sat
// in the nominative with no preposition while the H1 directly below already read "Plaže u Baru…".
test("titles every coastal beach listing with the locative city form", () => {
  const cities = seaWaterCities();
  assert.equal(cities.length > 0, true);

  for (const city of cities) {
    const title = getPageTitle(`Plaže u ${getCityName(city, "locative")} i kvalitet mora`);

    assert.equal(title, `Plaže u ${city.locativeName ?? city.name} i kvalitet mora | Gradom.me`);
    // The old nominative construction must never reappear.
    assert.doesNotMatch(title, new RegExp(`Plaže ${city.name}\\b`, "u"), city.id);
  }
});

test("resolves every live coastal city to its real grammatical form", () => {
  const titles = seaWaterCities().map(
    (city) => `Plaže u ${getCityName(city, "locative")} i kvalitet mora`,
  );

  assert.deepEqual(titles.sort(), [
    "Plaže u Baru i kvalitet mora",
    "Plaže u Budvi i kvalitet mora",
    "Plaže u Kotoru i kvalitet mora",
    "Plaže u Tivtu i kvalitet mora",
    "Plaže u Ulcinju i kvalitet mora",
  ]);
});

test("derives the form from the registry and hardcodes no coastal city", async () => {
  const source = await readFile(new URL("./page.tsx", import.meta.url), "utf8");

  assert.match(
    source,
    /const title = `Plaže u \$\{getCityName\(context\.city, "locative"\)\} i kvalitet mora`;/u,
  );
  assert.doesNotMatch(source, /Plaže \$\{context\.city\.name\}/u);
  for (const form of ["Baru", "Budvi", "Kotoru", "Tivtu"]) {
    assert.doesNotMatch(source, new RegExp(`"${form}"`, "u"), form);
  }
});

test("leaves the canonical, the description and the H1 untouched", async () => {
  const source = await readFile(new URL("./page.tsx", import.meta.url), "utf8");
  const page = await readFile(
    new URL(
      "../../../modules/sea-water-quality/presentation/sea-water-quality-page.tsx",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(source, /canonical: getSeaWaterQualityPath\(context\.city\),/u);
  // The description already used the locative and is deliberately unchanged in this pass.
  assert.match(
    source,
    /na javnim plažama u \$\{context\.city\.locativeName \?\? context\.city\.name\}/u,
  );
  // The H1 was already correct.
  assert.match(
    page,
    /title=\{`Plaže u \$\{city\.locativeName \?\? city\.name\} i kvalitet mora`\}/u,
  );
});
