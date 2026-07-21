import assert from "node:assert/strict";
import test from "node:test";

import { getPrivacyPolicyPath, getTermsOfUsePath } from "../config/public-routes.ts";

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
  assert.equal(getTermsOfUsePath(), "/me/uslovi-koriscenja");
  assert.equal(getPrivacyPolicyPath(), "/me/politika-privatnosti");
});
