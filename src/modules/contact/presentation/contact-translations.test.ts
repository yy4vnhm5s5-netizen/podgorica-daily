import assert from "node:assert/strict";
import test from "node:test";

import { getContactTranslations } from "./contact-translations.ts";
import { getContactPath } from "../../../shared/config/public-routes.ts";
import { getTranslations } from "../../../shared/lib/translations.ts";

test("provides the single-language platform contact copy and navigation destination", () => {
  assert.equal(
    getContactTranslations().heading,
    "Gradom.me svakog dana prati ono što je važno građanima.",
  );
  assert.equal(getContactTranslations().submit, "Pošalji upit");
  assert.equal(
    getContactTranslations().intro,
    "Lokalne informacije su često rasute između sajtova opština, javnih preduzeća, turističkih organizacija, organizatora događaja i drugih izvora. Gradom.me ih svakodnevno prikuplja, provjerava i objedinjuje kako bi građani na jednom mjestu imali pouzdane i ažurne informacije.",
  );
  assert.equal(getContactTranslations().partnershipLabel, "JEDNO MJESTO ZA LOKALNE INFORMACIJE");
  assert.equal(getContactTranslations().metadataTitle, "Partnerstva i saradnja | Gradom.me");
  assert.equal(
    getContactTranslations().messagePlaceholder,
    "Opišite vašu organizaciju, projekat ili ideju i navedite kako Gradom.me može pomoći.",
  );
  assert.equal(getTranslations("me").shell.navigation.contact, "Kontakt");
  assert.equal(getContactPath(), "/kontakt");
});
