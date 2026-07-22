import assert from "node:assert/strict";
import test from "node:test";

import {
  getCityPath,
  getCinemaPath,
  getContactPath,
  getEventDetailPath,
  getEventsPath,
  getFlightsPath,
  getGoingOutPath,
  getPrivacyPolicyPath,
  getTermsOfUsePath,
} from "../config/public-routes.ts";

import { getTranslations } from "./translations.ts";

test("localizes emergency-number labels in English", () => {
  const { emergencyNumbers } = getTranslations("en").dashboard;

  assert.deepEqual(emergencyNumbers, {
    ambulance: "Ambulance",
    fireService: "Fire service",
    label: "Emergency numbers",
    police: "Police",
  });
});

test("provides localized legal-footer labels and stable legal paths", () => {
  assert.deepEqual(getTranslations("me").shell.footer, {
    legalNavigation: "Pravne informacije",
    privacy: "Politika privatnosti",
    terms: "Uslovi korišćenja",
  });
  assert.deepEqual(getTranslations("en").shell.footer, {
    legalNavigation: "Legal information",
    privacy: "Privacy policy",
    terms: "Terms of use",
  });
  assert.equal(getTermsOfUsePath(), "/uslovi-koriscenja");
  assert.equal(getPrivacyPolicyPath(), "/politika-privatnosti");
  assert.equal(getContactPath(), "/kontakt");
  assert.equal(getCityPath("podgorica"), "/podgorica");
  assert.equal(getEventsPath("podgorica"), "/podgorica/dogadjaji");
  assert.equal(getCinemaPath("podgorica"), "/podgorica/filmovi");
  assert.equal(getEventDetailPath("podgorica", "event/a"), "/podgorica/dogadjaji/event%2Fa");
  assert.equal(getFlightsPath("podgorica"), "/podgorica/letovi");
  assert.equal(getGoingOutPath("podgorica"), "/podgorica/izlasci");
});
