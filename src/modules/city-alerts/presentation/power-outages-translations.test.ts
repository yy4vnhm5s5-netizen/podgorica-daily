import assert from "node:assert/strict";
import test from "node:test";

import { getPowerOutagesTranslations } from "./power-outages-translations.ts";
import { createCityContext, getCity } from "@/shared/config/cities";

test("uses the city's locative form in Budva electricity titles and empty copy", () => {
  const translations = getPowerOutagesTranslations("me", createCityContext("budva").city);

  assert.equal(translations.title, "Planirana isključenja struje u Budvi");
  assert.match(translations.description, /u Budvi/u);
  assert.equal(translations.empty, "Bez planiranih isključenja struje u Budvi.");
  assert.doesNotMatch(
    `${translations.title} ${translations.description} ${translations.empty}`,
    /Podgorici/u,
  );
});

test("gives the empty state its own heading and a last-checked label in both locales", () => {
  const podgorica = getCity("podgorica");
  assert.ok(podgorica);
  const me = getPowerOutagesTranslations("me", podgorica);
  const en = getPowerOutagesTranslations("en", podgorica);

  // Distinct from the H1, which is "Planirana isključenja struje u Podgorici".
  assert.equal(me.emptyTitle, "Nema najavljenih isključenja");
  assert.notEqual(me.emptyTitle, me.title);
  assert.equal(me.checkedAt, "Provjereno");
  assert.equal(en.emptyTitle, "No announced outages");
  assert.notEqual(en.emptyTitle, en.title);
  assert.equal(en.checkedAt, "Last checked");
});

test("keeps the empty sentence city-specific and grammatical", () => {
  for (const cityId of ["podgorica", "bar", "budva", "kotor", "tivat", "ulcinj"]) {
    const city = getCity(cityId);
    assert.ok(city);
    const { empty } = getPowerOutagesTranslations("me", city);

    assert.equal(empty, `Bez planiranih isključenja struje u ${city.locativeName ?? city.name}.`);
    assert.doesNotMatch(empty, /\{city\}/u);
  }
});

test("no longer offers a publication-time label for CEDIS outages", () => {
  const podgorica = getCity("podgorica");
  assert.ok(podgorica);
  const me = getPowerOutagesTranslations("me", podgorica);
  const en = getPowerOutagesTranslations("en", podgorica);

  // CEDIS publishes no publication timestamp, so there is nothing for this label to describe.
  assert.equal("publicationTime" in me, false);
  assert.equal("publicationTime" in en, false);
  // The time concepts that do exist are untouched.
  assert.equal(me.scheduledTime, "Datum i vrijeme");
  assert.equal(me.source, "Izvor: CEDIS");
  assert.equal(me.checkedAt, "Provjereno");
});
