import assert from "node:assert/strict";
import test from "node:test";

import { getDailyOverviewTranslations } from "./daily-overview-translations.ts";

test("uses the standard unavailable copy in the daily summary", () => {
  assert.equal(getDailyOverviewTranslations("me").unavailable, "Podaci trenutno nijesu dostupni.");
  assert.equal(getDailyOverviewTranslations("en").unavailable, "Data is currently unavailable.");
});

test("uses correct Montenegrin event and upcoming-count forms", () => {
  const translations = getDailyOverviewTranslations("me");

  assert.equal(translations.eventsToday(1), "1 događaj danas");
  assert.equal(translations.eventsToday(2), "2 događaja danas");
  assert.equal(translations.eventsToday(5), "5 događaja danas");
  assert.equal(translations.eventsToday(11), "11 događaja danas");
  assert.equal(translations.eventsToday(21), "21 događaj danas");
  assert.equal(translations.eventsUpcoming(1), "1 predstojeći");
  assert.equal(translations.eventsUpcoming(2), "2 predstojeća");
  assert.equal(translations.eventsUpcoming(5), "5 predstojećih");
  assert.equal(translations.eventsUpcoming(11), "11 predstojećih");
  assert.equal(translations.eventsUpcoming(21), "21 predstojeći");
  assert.equal(translations.eventsUpcoming(22), "22 predstojeća");
});
