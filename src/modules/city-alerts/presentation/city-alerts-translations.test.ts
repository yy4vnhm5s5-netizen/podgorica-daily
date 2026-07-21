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
  assert.equal(getCityAlertsTranslations("me").unavailable, "Podaci trenutno nijesu dostupni.");
  assert.equal(getCityAlertsTranslations("en").unavailable, "Data is currently unavailable.");
});

test("provides localized provider freshness prefixes", () => {
  assert.equal(getCityAlertsTranslations("me").updated, "Ažurirano");
  assert.equal(
    getCityAlertsTranslations("me").lastAvailableUpdate,
    "Posljednje dostupno ažuriranje:",
  );
  assert.equal(getCityAlertsTranslations("en").updated, "Updated");
  assert.equal(getCityAlertsTranslations("en").lastAvailableUpdate, "Last available update:");
});

test("uses the successful empty-state copy for planned power outages", () => {
  assert.equal(getCityAlertsTranslations("me").noPowerOutages, "Bez planiranih isključenja.");
  assert.equal(getCityAlertsTranslations("me").moreLocations, "Još {count} lokacija");
});

test("uses the specific successful empty-state copy for water interruptions", () => {
  assert.equal(
    getCityAlertsTranslations("me").noWaterInterruptions,
    "Nema aktivnih obavještenja o prekidima u vodosnabdijevanju.",
  );
});
