import assert from "node:assert/strict";
import test from "node:test";

import { getDailyOverviewTranslations } from "./daily-overview-translations.ts";

test("uses a concise no-events label in the daily summary", () => {
  assert.equal(getDailyOverviewTranslations("me").noEvents, "Bez događaja");
  assert.equal(getDailyOverviewTranslations("en").noEvents, "No events");
});
