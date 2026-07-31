import assert from "node:assert/strict";
import test from "node:test";

import { getContactTranslations } from "./contact-translations.ts";
import { getContactPath } from "../../../shared/config/public-routes.ts";
import { getTranslations } from "../../../shared/lib/translations.ts";

test("provides the single-language partnership contact copy and navigation destination", () => {
  assert.equal(
    getContactTranslations().heading,
    "Povežimo građane sa informacijama koje su im zaista važne.",
  );
  assert.equal(getContactTranslations().submit, "Pošalji upit");
  assert.equal(
    getContactTranslations().intro,
    "Gradom.me sarađuje sa opštinama, turističkim organizacijama, javnim ustanovama, komunalnim preduzećima, organizatorima događaja i lokalnim kompanijama kako bi važne gradske informacije bile tačne, ažurne i lako dostupne građanima.",
  );
  assert.equal(getContactTranslations().metadataTitle, "Partnerstva i saradnja | Gradom.me");
  assert.equal(
    getContactTranslations().messagePlaceholder,
    "Opišite vašu organizaciju, projekat ili ideju i navedite kako Gradom.me može pomoći.",
  );
  assert.equal(getTranslations("me").shell.navigation.contact, "Kontakt");
  assert.equal(getContactPath(), "/kontakt");
});
