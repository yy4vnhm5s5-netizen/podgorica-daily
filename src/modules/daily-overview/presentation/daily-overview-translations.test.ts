import assert from "node:assert/strict";
import test from "node:test";

import { getDailyOverviewTranslations } from "./daily-overview-translations.ts";

test("uses the summary labels and count forms", () => {
  const translations = getDailyOverviewTranslations("me");

  assert.equal(translations.performancesLabel, "Nastupi");
  assert.equal(translations.eventsLabel, "Događaji");
  assert.equal(translations.moviesLabel, "Filmovi");
  assert.equal(translations.performancesCount(0), "0 Nastupa");
  assert.equal(translations.performancesCount(1), "1 Nastup");
  assert.equal(translations.eventsCount(1), "1 Događaj");
  assert.equal(translations.eventsCount(2), "2 Događaja");
  assert.equal(translations.eventsCount(21), "21 Događaj");
  assert.equal(translations.moviesCount(0), "0 Filmova");
  assert.equal(translations.moviesCount(1), "1 Film");
  assert.equal(translations.moviesCount(2), "2 Filmova");
});

test("uses English singular and plural forms in the retained locale infrastructure", () => {
  const translations = getDailyOverviewTranslations("en");

  assert.equal(translations.performancesCount(0), "0 Performances");
  assert.equal(translations.performancesCount(1), "1 Performance");
  assert.equal(translations.eventsCount(2), "2 Events");
  assert.equal(translations.moviesCount(1), "1 Movie");
});
