import assert from "node:assert/strict";
import test from "node:test";

import { parseContactInquiry } from "./contact-inquiry.ts";

test("accepts a complete contact inquiry", () => {
  const result = parseContactInquiry({
    email: "ana@example.com",
    fullName: "Ana Petrović",
    locale: "me",
    message: "Zanima me saradnja sa Gradom-om.",
  });

  assert.equal(result.success, true);
  if (!result.success) return;
  assert.deepEqual(result.inquiry, {
    email: "ana@example.com",
    fullName: "Ana Petrović",
    locale: "me",
    message: "Zanima me saradnja sa Gradom-om.",
  });
});

test("returns required field validation errors without accepting an incomplete inquiry", () => {
  const result = parseContactInquiry({
    email: "invalid",
    fullName: "",
    locale: "me",
    message: "",
  });

  assert.equal(result.success, false);
  if (result.success) return;
  assert.deepEqual(result.fieldErrors, {
    email: "Unesite ispravnu e-mail adresu.",
    fullName: "Unesite ime i prezime.",
    message: "Poruka mora sadržati najmanje 10 znakova.",
  });
  assert.doesNotMatch(JSON.stringify(result.fieldErrors), /Invalid|String must|Expected/u);
});

test("returns a stable localized message when the message exceeds its limit", () => {
  const result = parseContactInquiry({
    email: "ana@example.com",
    fullName: "Ana Petrović",
    locale: "me",
    message: "a".repeat(4_001),
  });

  assert.equal(result.success, false);
  if (result.success) return;
  assert.equal(result.fieldErrors.message, "Poruka može sadržati najviše 4000 znakova.");
});
