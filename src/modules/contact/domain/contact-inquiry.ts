import { z } from "zod";

import type { Locale } from "@/shared/config/locale";

const contactInquiryFieldNames = ["fullName", "email", "company", "phone", "message"] as const;

type ContactInquiryField = (typeof contactInquiryFieldNames)[number];

interface ContactInquiry {
  company?: string;
  email: string;
  fullName: string;
  locale: Locale;
  message: string;
  phone?: string;
}

type ContactInquiryFieldErrors = Partial<Record<ContactInquiryField, string>>;

const optionalText = (maximumLength: number) =>
  z
    .string()
    .trim()
    .max(maximumLength)
    .transform((value) => value || undefined)
    .optional();

const contactInquirySchema = z.object({
  company: optionalText(120),
  email: z.string().trim().email().max(254),
  fullName: z.string().trim().min(2).max(100),
  locale: z.enum(["me", "en"]),
  message: z.string().trim().min(10).max(4000),
  phone: optionalText(40),
});

function parseContactInquiry(
  value: unknown,
):
  | { inquiry: ContactInquiry; success: true }
  | { fieldErrors: ContactInquiryFieldErrors; success: false } {
  const parsed = contactInquirySchema.safeParse(value);
  if (parsed.success) {
    const { company, phone, ...inquiry } = parsed.data;
    return {
      inquiry: {
        ...inquiry,
        ...(company ? { company } : {}),
        ...(phone ? { phone } : {}),
      },
      success: true,
    };
  }

  const fieldErrors: ContactInquiryFieldErrors = {};
  for (const field of contactInquiryFieldNames) {
    const message = parsed.error.flatten().fieldErrors[field]?.[0];
    if (message) fieldErrors[field] = message;
  }

  return { fieldErrors, success: false };
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
