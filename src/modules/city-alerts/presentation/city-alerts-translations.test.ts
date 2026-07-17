import assert from "node:assert/strict";
import test from "node:test";

import { getCityAlertsTranslations } from "./city-alerts-translations.ts";

test("provides localized stale-data copy", () => {
  assert.equal(
    getCityAlertsTranslations("me").staleData,
    "Podaci mogu biti zastarjeli. Posljednje uspješno ažuriranje:",
  );
  assert.equal(
    getCityAlertsTranslations("en").staleData,
    "Data may be outdated. Last successful update:",
  );
});

test("provides localized source-unavailable copy", () => {
  assert.equal(
    getCityAlertsTranslations("me").unavailable,
    "CEDIS podaci trenutno nijesu dostupni.",
  );
  assert.equal(getCityAlertsTranslations("en").unavailable, "CEDIS data is currently unavailable.");
});
