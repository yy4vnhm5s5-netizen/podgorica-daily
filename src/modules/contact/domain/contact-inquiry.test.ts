import assert from "node:assert/strict";
import test from "node:test";

import { parseContactInquiry } from "./contact-inquiry.ts";

test("accepts a complete contact inquiry and normalizes blank optional fields", () => {
  const result = parseContactInquiry({
    company: "  ",
    email: "ana@example.com",
    fullName: "Ana Petrović",
    locale: "me",
    message: "Zanima me saradnja sa Gradom-om.",
    phone: "",
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
  assert.ok(result.fieldErrors.fullName);
  assert.ok(result.fieldErrors.email);
  assert.ok(result.fieldErrors.message);
});
