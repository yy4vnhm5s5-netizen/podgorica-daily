import type { ContactInquiry } from "../domain/contact-inquiry.ts";

interface ContactSubmissionMetadata {
  clientIp?: string;
  submittedAt: string;
  userAgent?: string;
}

function formatContactInquiryMessage(
  inquiry: ContactInquiry,
  { clientIp, submittedAt, userAgent }: ContactSubmissionMetadata,
) {
  return [
    "Gradom contact inquiry",
    "",
    `Submission timestamp: ${submittedAt}`,
    `Sender name: ${inquiry.fullName}`,
    `Sender email: ${inquiry.email}`,
    ...(inquiry.company ? [`Company: ${inquiry.company}`] : []),
    ...(inquiry.phone ? [`Phone: ${inquiry.phone}`] : []),
    ...(clientIp ? [`Client IP: ${clientIp}`] : []),
    ...(userAgent ? [`User-Agent: ${userAgent}`] : []),
    "",
    "Message:",
    inquiry.message,
  ].join("\n");
}

export { formatContactInquiryMessage, type ContactSubmissionMetadata };
