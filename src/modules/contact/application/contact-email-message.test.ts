import assert from "node:assert/strict";
import test from "node:test";

import { formatContactInquiryMessage } from "./contact-email-message.ts";

test("formats a complete contact inquiry for a professional delivery email", () => {
  const message = formatContactInquiryMessage(
    {
      company: "Gradom partner",
      email: "ana@example.com",
      fullName: "Ana Petrović",
      locale: "me",
      message: "Zanima me saradnja sa Gradom-om.",
      phone: "+382 67 123 456",
    },
    {
      clientIp: "203.0.113.10",
      submittedAt: "2026-07-20T09:30:00.000Z",
      userAgent: "Gradom Contact Test/1.0",
    },
  );

  assert.equal(
    message,
    [
      "Gradom contact inquiry",
      "",
      "Submission timestamp: 2026-07-20T09:30:00.000Z",
      "Sender name: Ana Petrović",
      "Sender email: ana@example.com",
      "Company: Gradom partner",
      "Phone: +382 67 123 456",
      "Client IP: 203.0.113.10",
      "User-Agent: Gradom Contact Test/1.0",
      "",
      "Message:",
      "Zanima me saradnja sa Gradom-om.",
    ].join("\n"),
  );
});

test("omits optional contact and request metadata when unavailable", () => {
  const message = formatContactInquiryMessage(
    {
      email: "ana@example.com",
      fullName: "Ana Petrović",
      locale: "me",
      message: "Zanima me saradnja sa Gradom-om.",
    },
    { submittedAt: "2026-07-20T09:30:00.000Z" },
  );

  assert.doesNotMatch(message, /Company:|Phone:|Client IP:|User-Agent:/);
});
