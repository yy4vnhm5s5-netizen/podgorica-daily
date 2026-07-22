import assert from "node:assert/strict";
import test from "node:test";

import { getLegacyEnglishRedirectPath } from "./legacy-english-redirects.ts";
import { getLocaleAlternates, locales, publicLocales } from "./locale.ts";

test("keeps English translation support while exposing only Montenegrin in production", () => {
  assert.deepEqual(locales, ["me", "en"]);
  assert.deepEqual(publicLocales, ["me"]);
  assert.deepEqual(getLocaleAlternates("/events"), {
    "sr-Latn-ME": "/me/events",
    "x-default": "/me/events",
  });
});

test("maps legacy English URLs to matching primary routes", () => {
  assert.equal(getLegacyEnglishRedirectPath("/en"), "/");
  assert.equal(getLegacyEnglishRedirectPath("/en/contact"), "/kontakt");
  assert.equal(getLegacyEnglishRedirectPath("/en/events"), "/events");
  assert.equal(getLegacyEnglishRedirectPath("/en/events/event-1"), "/events/event-1");
  assert.equal(getLegacyEnglishRedirectPath("/en/electricity"), "/struja");
  assert.equal(getLegacyEnglishRedirectPath("/en/cinema"), "/me");
  assert.equal(getLegacyEnglishRedirectPath("/en/unknown"), "/");
});
