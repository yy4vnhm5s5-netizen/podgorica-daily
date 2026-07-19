import assert from "node:assert/strict";
import test from "node:test";

import { getDailyOverviewTranslations } from "./daily-overview-translations.ts";

test("uses the standard unavailable copy in the daily summary", () => {
  assert.equal(getDailyOverviewTranslations("me").unavailable, "Podaci trenutno nijesu dostupni.");
  assert.equal(getDailyOverviewTranslations("en").unavailable, "Data is currently unavailable.");
});
