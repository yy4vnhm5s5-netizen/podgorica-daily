import assert from "node:assert/strict";
import test from "node:test";

import { getPageTitle, siteConfig } from "./site.ts";

test("uses Gradom.me as the public site brand and a city-neutral fallback description", () => {
  assert.equal(siteConfig.name, "Gradom.me");
  assert.equal(siteConfig.homepageTitle, "Gradom.me | Sve o vašem gradu");
  assert.match(siteConfig.description, /gradove Crne Gore/u);
  assert.equal(getPageTitle("Kontakt"), "Kontakt | Gradom.me");
});
