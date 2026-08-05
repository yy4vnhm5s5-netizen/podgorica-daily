import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { resolveActiveCityFeatureRoute } from "@/app/city-routing";
import { getActiveCities } from "@/shared/config/cities";

const layoutSource = async () => readFile(new URL("./layout.tsx", import.meta.url), "utf8");

// The layout's decision is exactly this call, so the availability rule is asserted directly and the
// Next-specific wiring is asserted structurally — no test in this repo boots a Next runtime.
const eventsRouteAvailable = (slug: string) =>
  resolveActiveCityFeatureRoute(slug, "events") !== undefined;

test("supported events cities resolve, and every other city does not", () => {
  assert.equal(eventsRouteAvailable("podgorica"), true);
  assert.equal(eventsRouteAvailable("tivat"), true);

  for (const slug of ["budva", "kotor", "bar", "ulcinj"]) {
    assert.equal(eventsRouteAvailable(slug), false, slug);
  }
  // Inactive registry entries never resolve either.
  assert.equal(eventsRouteAvailable("niksic"), false);
  assert.equal(eventsRouteAvailable("nepostojeci-grad"), false);
});

test("the guard covers every active city, not a hardcoded pair", () => {
  // Derived from the registry: if a city gains the events capability it is admitted with no edit
  // here, and the layout keeps rejecting the rest.
  for (const city of getActiveCities()) {
    assert.equal(
      eventsRouteAvailable(city.slug),
      city.capabilities?.includes("events") === true,
      city.id,
    );
  }
});

test("the layout guards above the streaming boundary using the shared helper", async () => {
  const source = await layoutSource();

  // A layout resolves before the segment's loading.tsx can stream, so the 404 status is still
  // settable — that is the whole point of putting the check here rather than in the page.
  assert.match(source, /resolveActiveCityFeatureRoute\(slug, "events"\)/u);
  assert.match(source, /notFound\(\)/u);
  assert.match(source, /await params/u);
});

test("no second events city allow-list was introduced", async () => {
  const source = await layoutSource();

  // The only permitted source of truth is the shared helper; a literal city list here would be a
  // second allow-list that could drift from the registry and the sitemap.
  for (const slug of ["podgorica", "tivat", "budva", "kotor", "bar", "ulcinj"]) {
    assert.doesNotMatch(source, new RegExp(`"${slug}"`, "u"), slug);
  }
  assert.doesNotMatch(source, /capabilities|supportsCityCapability/u);
});

test("the loading skeleton is still present and unweakened", async () => {
  const loading = await readFile(new URL("./loading.tsx", import.meta.url), "utf8");

  // The fix must not have been "delete the skeleton": supported cities keep it.
  assert.match(loading, /function EventsLoading/u);
  assert.equal((loading.match(/role="status"/gu) ?? []).length, 1);
  assert.equal((loading.match(/announce=\{false\}/gu) ?? []).length, 3);
});

test("the page keeps its own context resolution and narrowing", async () => {
  const page = await readFile(new URL("./page.tsx", import.meta.url), "utf8");

  // Retained deliberately: the page needs the resolved context object itself, and the check is what
  // narrows it from `CityContext | undefined`. It is no longer the 404 path, but it is not dead.
  assert.match(page, /resolveActiveCityFeatureRoute\(slug, "events"\)/u);
  assert.match(page, /if \(!context\) notFound\(\);/u);
});
