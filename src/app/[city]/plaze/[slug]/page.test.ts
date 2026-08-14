import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { createCityContext } from "@/shared/config/cities";
import { isCityPublicFeatureRouteAvailable } from "@/app/city-routing";

test("uses the same public Sea Water feature availability gate for the detail route and metadata", async () => {
  const route = await readFile(new URL("./page.tsx", import.meta.url), "utf8");

  assert.match(route, /isCityPublicFeatureRouteAvailable\(context\.city, "seaWaterQuality"\)/u);
  assert.match(
    route,
    /if \(!context \|\| !isCityPublicFeatureRouteAvailable\(context\.city, "seaWaterQuality"\)\)/u,
  );
  assert.match(route, /const detail = await getPublicLocation\(citySlug, slug\);/u);
  assert.match(route, /if \(!detail\) return \{\};/u);
  assert.match(route, /if \(!detail\) notFound\(\);/u);
});

test("matches listing availability when the Sea Water feature is enabled or disabled", () => {
  const budva = createCityContext("budva").city;

  assert.equal(isCityPublicFeatureRouteAvailable(budva, "seaWaterQuality"), true);
  assert.equal(
    isCityPublicFeatureRouteAvailable(budva, "seaWaterQuality", {
      isFeatureEnabled: () => false,
    }),
    false,
  );
});
