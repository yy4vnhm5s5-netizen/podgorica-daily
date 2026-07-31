import assert from "node:assert/strict";
import test from "node:test";

import { getDailyOverviewTranslations } from "./daily-overview-translations.ts";
import { getCity } from "@/shared/config/cities";

test("uses grammatically correct bare noun forms (no digit attached)", () => {
  const translations = getDailyOverviewTranslations("me");

  assert.equal(translations.performancesCount(0), "nastupa");
  assert.equal(translations.performancesCount(1), "nastup");
  assert.equal(translations.performancesCount(31), "nastup");
  assert.equal(translations.eventsCount(1), "događaj");
  assert.equal(translations.eventsCount(2), "događaja");
  assert.equal(translations.eventsCount(21), "događaj");
  assert.equal(translations.moviesCount(0), "filmova");
  assert.equal(translations.moviesCount(1), "film");
  assert.equal(translations.moviesCount(2), "filma");
  assert.equal(translations.moviesCount(4), "filma");
  // Regression: a hardcoded count===1 check would incorrectly say "filmova" instead of "film".
  assert.equal(translations.moviesCount(21), "film");
  assert.equal(translations.moviesCount(22), "filma");
  assert.equal(translations.seaWaterQualityCount(1), "kupalište");
  assert.equal(translations.seaWaterQualityCount(3), "kupališta");
  assert.equal(translations.seaWaterQualityCount(9), "kupališta");
});

test("uses English singular and plural noun forms in the retained locale infrastructure", () => {
  const translations = getDailyOverviewTranslations("en");

  assert.equal(translations.performancesCount(0), "performances");
  assert.equal(translations.performancesCount(1), "performance");
  assert.equal(translations.eventsCount(2), "events");
  assert.equal(translations.moviesCount(1), "movie");
});

test("uses the current city in the summary label", () => {
  const budva = getCity("budva");
  assert.ok(budva);

  assert.equal(getDailyOverviewTranslations("me", budva).summaryLabel, "Danas u Budvi");
});

test("provides the dashboard summary subtitle in every locale", () => {
  assert.equal(
    getDailyOverviewTranslations("me").summaryDescription,
    "Pregled događaja, usluga i obavještenja u gradu.",
  );
  assert.equal(
    getDailyOverviewTranslations("en").summaryDescription,
    "An overview of local information for the day.",
  );
});
