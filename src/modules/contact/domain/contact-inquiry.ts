import { z } from "zod";

import type { Locale } from "@/shared/config/locale";

const contactInquiryFieldNames = ["fullName", "email", "message"] as const;

type ContactInquiryField = (typeof contactInquiryFieldNames)[number];

interface ContactInquiry {
  email: string;
  fullName: string;
  locale: Locale;
  message: string;
}

type ContactInquiryFieldErrors = Partial<Record<ContactInquiryField, string>>;

const contactInquiryValidationMessages: Record<ContactInquiryField, string> = {
  email: "Unesite ispravnu e-mail adresu.",
  fullName: "Unesite ime i prezime.",
  message: "Poruka mora sadržati najmanje 10 znakova.",
};

const contactInquirySchema = z.object({
  email: z.string().trim().email().max(254),
  fullName: z.string().trim().min(2).max(100),
  locale: z.enum(["me", "en"]),
  message: z.string().trim().min(10).max(4000),
});

function parseContactInquiry(
  value: unknown,
):
  | { inquiry: ContactInquiry; success: true }
  | { fieldErrors: ContactInquiryFieldErrors; success: false } {
  const parsed = contactInquirySchema.safeParse(value);
  if (parsed.success) {
    return { inquiry: parsed.data, success: true };
  }

  return { fieldErrors: getContactInquiryFieldErrors(parsed.error.issues), success: false };
}

function getContactInquiryFieldErrors(issues: readonly z.ZodIssue[]): ContactInquiryFieldErrors {
  const fieldErrors: ContactInquiryFieldErrors = {};

  for (const issue of issues) {
    const field = issue.path[0];
    if (!isContactInquiryField(field) || fieldErrors[field]) continue;

    fieldErrors[field] = getContactInquiryValidationMessage(field, issue);
  }

  return fieldErrors;
}

function getContactInquiryValidationMessage(field: ContactInquiryField, issue: z.ZodIssue) {
  if (issue.code === "too_big") {
    if (field === "email") return "E-mail adresa može sadržati najviše 254 znaka.";
    if (field === "fullName") return "Ime i prezime može sadržati najviše 100 znakova.";
    if (field === "message") return "Poruka može sadržati najviše 4000 znakova.";
  }

  return contactInquiryValidationMessages[field];
}

function isContactInquiryField(value: unknown): value is ContactInquiryField {
  return (
    typeof value === "string" && contactInquiryFieldNames.includes(value as ContactInquiryField)
  );
}

function hasCompletedContactHoneypot(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

export {
  contactInquirySchema,
  hasCompletedContactHoneypot,
  parseContactInquiry,
  type ContactInquiry,
  type ContactInquiryField,
  type ContactInquiryFieldErrors,
};
