import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("resolves the internal Going Out detail from the normal public snapshot only", async () => {
  const route = await readFile(new URL("./page.tsx", import.meta.url), "utf8");

  assert.match(route, /resolveActiveCityFeatureRoute\(slug, "goingOut"\)/u);
  assert.match(route, /isCityPublicFeatureRouteAvailable\(context\.city, "goingOut"\)/u);
  assert.match(route, /getCachedGoingOutEvents = cache\(getGoingOutEvents\)/u);
  assert.match(route, /resolvePublicGoingOutDetail\(\{/u);
  assert.match(route, /if \(!detail\) notFound\(\);/u);
  assert.doesNotMatch(
    route,
    /fetch\(|montegigs-going-out\.ts|detail-enrichment|createMonteGigsHttpClient|runMonteGigs/u,
  );
  assert.doesNotMatch(route, /"use client"|'use client'/u);
});

test("uses the same public availability gate as the listing and sitemap", async () => {
  const [detailRoute, listingRoute, sitemap] = await Promise.all([
    readFile(new URL("./page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../../sitemap.ts", import.meta.url), "utf8"),
  ]);

  for (const source of [detailRoute, listingRoute, sitemap]) {
    assert.match(source, /isCityPublicFeatureRouteAvailable/u);
  }
  assert.match(
    detailRoute,
    /if \(!context \|\| !isCityPublicFeatureRouteAvailable\(context\.city, "goingOut"\)\)/u,
  );
});

test("keeps canonical metadata, structured data and the full visible event separate", async () => {
  const route = await readFile(new URL("./page.tsx", import.meta.url), "utf8");
  const detail = await readFile(
    new URL("../../../../modules/going-out/presentation/going-out-detail.tsx", import.meta.url),
    "utf8",
  );

  assert.match(route, /canonical: getGoingOutDetailPath\(/u);
  assert.match(route, /createGoingOutDetailMetadataTitle/u);
  assert.match(route, /createGoingOutDetailMetadataDescription/u);
  assert.match(route, /createGoingOutDetailStructuredData/u);
  assert.match(route, /createGoingOutDetailBreadcrumbStructuredData/u);
  assert.match(detail, /title=\{event\.title\}/u);
});
