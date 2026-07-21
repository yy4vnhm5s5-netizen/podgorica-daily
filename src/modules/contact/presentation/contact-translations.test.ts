import assert from "node:assert/strict";
import test from "node:test";

import { getContactTranslations } from "./contact-translations.ts";
import { getContactPath } from "../../../shared/config/public-routes.ts";
import { getTranslations } from "../../../shared/lib/translations.ts";

test("provides localized contact labels and navigation destinations", () => {
  assert.equal(getContactTranslations("me").heading, "Kontakt");
  assert.equal(getContactTranslations("me").submit, "Pošalji upit");
  assert.equal(
    getContactTranslations("me").intro,
    "Zainteresovani ste za oglašavanje ili saradnju sa servisom Gradom.me? Pošaljite nam upit putem forme i javićemo vam se u najkraćem roku.",
  );
  assert.equal(getContactTranslations("en").heading, "Contact");
  assert.equal(getContactTranslations("en").submit, "Send inquiry");
  assert.equal(getTranslations("me").shell.navigation.contact, "Kontakt");
  assert.equal(getTranslations("en").shell.navigation.contact, "Contact");
  assert.equal(getContactPath("me"), "/me/kontakt");
  assert.equal(getContactPath("en"), "/en/contact");
});
