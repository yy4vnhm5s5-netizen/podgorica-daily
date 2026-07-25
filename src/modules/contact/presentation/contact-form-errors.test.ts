import assert from "node:assert/strict";
import test from "node:test";

import { getContactFormErrorSummaryItems } from "./contact-form-errors.ts";

const fieldIds = {
  company: "contact-company",
  email: "contact-email",
  fullName: "contact-full-name",
  message: "contact-message",
  phone: "contact-phone",
};

test("creates ordered error-summary links for only invalid contact fields", () => {
  const items = getContactFormErrorSummaryItems(
    {
      email: "Unesite ispravnu e-mail adresu.",
      message: "Poruka mora sadržati najmanje 10 znakova.",
    },
    fieldIds,
  );

  assert.deepEqual(items, [
    {
      field: "email",
      href: "#contact-email",
      message: "Unesite ispravnu e-mail adresu.",
    },
    {
      field: "message",
      href: "#contact-message",
      message: "Poruka mora sadržati najmanje 10 znakova.",
    },
  ]);
});

test("does not create an error summary when there are no field errors", () => {
  assert.deepEqual(getContactFormErrorSummaryItems({}, fieldIds), []);
});
