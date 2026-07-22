import assert from "node:assert/strict";
import test from "node:test";

import {
  getLegacyEnglishRedirectPath,
  getLegacyMontenegrinRedirectPath,
} from "./legacy-english-redirects.ts";
import { getLocaleAlternates, locales } from "./locale.ts";

test("keeps locale types and translations while root paths are canonical", () => {
  assert.deepEqual(locales, ["me", "en"]);
  assert.deepEqual(getLocaleAlternates("/dogadjaji"), {
    "sr-Latn-ME": "/dogadjaji",
    "x-default": "/dogadjaji",
  });
});

test("maps legacy English URLs to matching primary routes", () => {
  assert.equal(getLegacyEnglishRedirectPath("/en"), "/");
  assert.equal(getLegacyEnglishRedirectPath("/en/contact"), "/kontakt");
  assert.equal(getLegacyEnglishRedirectPath("/en/events"), "/dogadjaji");
  assert.equal(getLegacyEnglishRedirectPath("/en/events/event-1"), "/dogadjaji/event-1");
  assert.equal(getLegacyEnglishRedirectPath("/en/electricity"), "/struja");
  assert.equal(getLegacyEnglishRedirectPath("/en/cinema"), "/#bioskop");
  assert.equal(getLegacyEnglishRedirectPath("/en/unknown"), "/");
});

test("maps legacy Montenegrin locale routes to their root canonical equivalents", () => {
  assert.equal(getLegacyMontenegrinRedirectPath("/me"), "/");
  assert.equal(getLegacyMontenegrinRedirectPath("/me/izlasci"), "/izlasci");
  assert.equal(getLegacyMontenegrinRedirectPath("/me/letovi/"), "/letovi");
  assert.equal(getLegacyMontenegrinRedirectPath("/me/dogadjaji"), "/dogadjaji");
  assert.equal(getLegacyMontenegrinRedirectPath("/me/events/event-1/"), "/dogadjaji/event-1");
  assert.equal(getLegacyMontenegrinRedirectPath("/me/unknown"), "/");
});
