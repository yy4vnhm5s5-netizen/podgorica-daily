import type {
  ContactInquiryField,
  ContactInquiryFieldErrors,
} from "@/modules/contact/domain/contact-inquiry";

const contactFieldOrder: readonly ContactInquiryField[] = [
  "fullName",
  "email",
  "company",
  "phone",
  "message",
];

type ContactFormFieldIds = Record<ContactInquiryField, string>;

interface ContactFormErrorSummaryItem {
  field: ContactInquiryField;
  href: string;
  message: string;
}

function getContactFormErrorSummaryItems(
  errors: ContactInquiryFieldErrors,
  fieldIds: ContactFormFieldIds,
): readonly ContactFormErrorSummaryItem[] {
  return contactFieldOrder.flatMap((field) => {
    const message = errors[field];
    return message ? [{ field, href: `#${fieldIds[field]}`, message }] : [];
  });
}

export {
  getContactFormErrorSummaryItems,
  type ContactFormErrorSummaryItem,
  type ContactFormFieldIds,
};
