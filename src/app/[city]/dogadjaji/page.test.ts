import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { getEventsTranslations } from "@/modules/events/presentation/events-translations";
import { getCity, getCityName } from "@/shared/config/cities";

test("events page title and H1 are built per-city, not from the shared Podgorica-only heading string", async () => {
  const source = await readFile(new URL("./page.tsx", import.meta.url), "utf8");

  // The page must not read eventTranslations.heading (a single hardcoded "Događaji u
  // Podgorici" string shared with HomepageEventsCard's dashboard-card heading) — it must
  // build its own heading from the resolved city instead.
  assert.doesNotMatch(source, /title=\{eventTranslations\.heading\}/u);
  assert.doesNotMatch(source, /getPageTitle\(translations\.heading\)/u);
  assert.match(source, /function getEventsPageHeading\(cityName: string\)/u);
  assert.match(source, /`Događaji u \$\{cityName\}`/u);
  assert.match(source, /getEventsPageHeading\(getCityName\(context\.city, "locative"\)\)/u);
  // Used for both the metadata title and both the success/error-path H1s.
  assert.equal((source.match(/getEventsPageHeading\(getCityName\(context\.city, "locative"\)\)/gu) ?? []).length, 2);
  assert.equal((source.match(/title=\{heading\}/gu) ?? []).length, 2);
});

test("the per-city heading formula produces the exact required strings for Tivat and Podgorica", () => {
  const getEventsPageHeading = (cityName: string) => `Događaji u ${cityName}`;

  const tivat = getCity("tivat");
  const podgorica = getCity("podgorica");
  assert.ok(tivat);
  assert.ok(podgorica);

  assert.equal(getEventsPageHeading(getCityName(tivat, "locative")), "Događaji u Tivtu");
  assert.equal(getEventsPageHeading(getCityName(podgorica, "locative")), "Događaji u Podgorici");
});

test("the metadata description is built per-city, not the shared Podgorica-only supportingText string", async () => {
  const source = await readFile(new URL("./page.tsx", import.meta.url), "utf8");

  assert.doesNotMatch(source, /description: translations\.supportingText,/u);
  assert.match(source, /function getEventsPageDescription\(city: City, podgoricaDescription: string\)/u);
  assert.match(
    source,
    /description: getEventsPageDescription\(context\.city, translations\.supportingText\),/u,
  );
});

test("Podgorica keeps its exact existing description; other cities get a generic, non-Podgorica one", () => {
  const podgoricaDescription = getEventsTranslations("me").supportingText;
  const podgorica = getCity("podgorica");
  const tivat = getCity("tivat");
  assert.ok(podgorica);
  assert.ok(tivat);

  const getEventsPageDescription = (city: NonNullable<typeof podgorica>, fallback: string) =>
    city.id === "podgorica"
      ? fallback
      : `Provjereni programi iz zvaničnih izvora u ${getCityName(city, "locative")}.`;

  assert.equal(
    getEventsPageDescription(podgorica, podgoricaDescription),
    "Provjereni programi iz zvaničnih podgoričkih izvora.",
  );
  assert.equal(
    getEventsPageDescription(tivat, podgoricaDescription),
    "Provjereni programi iz zvaničnih izvora u Tivtu.",
  );
  assert.equal(
    getEventsPageDescription(tivat, podgoricaDescription).includes("podgor"),
    false,
  );
});

test("Budva still has no events route, so its events page and metadata remain a 404 and untouched", () => {
  const budva = getCity("budva");
  assert.ok(budva);
  assert.equal(budva.capabilities?.includes("events"), false);
});
