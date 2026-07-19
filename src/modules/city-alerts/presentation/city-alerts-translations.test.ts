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
  assert.equal(getCityAlertsTranslations("me").unavailable, "Nema podataka.");
  assert.equal(getCityAlertsTranslations("en").unavailable, "No data.");
});

test("uses the successful empty-state copy for planned power outages", () => {
  assert.equal(getCityAlertsTranslations("me").noPowerOutages, "Nema planiranih isključenja.");
});

test("uses the specific successful empty-state copy for water interruptions", () => {
  assert.equal(
    getCityAlertsTranslations("me").noWaterInterruptions,
    "Nema aktivnih obavještenja o prekidima u vodosnabdijevanju.",
  );
});
