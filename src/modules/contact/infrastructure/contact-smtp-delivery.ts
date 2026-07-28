import nodemailer from "nodemailer";

import {
  ContactDeliveryUnavailableError,
  type ContactInquiryDelivery,
} from "@/modules/contact/application/submit-contact-inquiry";
import { formatContactInquiryMessage } from "@/modules/contact/application/contact-email-message";

interface ContactSmtpConfiguration {
  contactEmail: string;
  from: string;
  host: string;
  password?: string;
  port: number;
  secure: boolean;
  username?: string;
}

function createSmtpContactDelivery(
  configuration: ContactSmtpConfiguration | undefined,
): ContactInquiryDelivery {
  if (!configuration) {
    return {
      async deliver() {
        throw new ContactDeliveryUnavailableError();
      },
    };
  }

  // TEMPORARY DEBUG LOGGING — remove once the "hangs on Slanje..." issue is diagnosed.
  // NOTE: createSmtpContactDelivery runs once at route-module load (cold start), not per
  // request, so these two log lines will appear once per server instance, not once per
  // submission — they confirm the transporter was actually constructed with the expected
  // (non-secret) host/port/secure settings.
  console.log("[contact-debug] 4. before creating SMTP transporter", {
    host: configuration.host,
    port: configuration.port,
    secure: configuration.secure,
  });
  const transporter = nodemailer.createTransport({
    auth:
      configuration.username && configuration.password
        ? { pass: configuration.password, user: configuration.username }
        : undefined,
    host: configuration.host,
    port: configuration.port,
    secure: configuration.secure,
  });
  console.log("[contact-debug] 5. after transporter created");

  return {
    async deliver({ inquiry, metadata }) {
      // TEMPORARY DEBUG LOGGING — remove once the "hangs on Slanje..." issue is diagnosed.
      console.log("[contact-debug] 8. before transporter.sendMail()");
      await transporter.sendMail({
        from: configuration.from,
        replyTo: inquiry.email,
        subject: "Gradom — Contact inquiry",
        text: formatContactInquiryMessage(inquiry, metadata),
        to: configuration.contactEmail,
      });
      console.log("[contact-debug] 9. after transporter.sendMail() resolved");
    },
  };
}

function getContactSmtpConfiguration({
  contactEmail,
  from,
  host,
  password,
  port,
  secure,
  username,
}: {
  contactEmail?: string;
  from?: string;
  host?: string;
  password?: string;
  port?: number;
  secure: boolean;
  username?: string;
}): ContactSmtpConfiguration | undefined {
  if (!contactEmail || !from || !host || !port || Boolean(username) !== Boolean(password))
    return undefined;

  return { contactEmail, from, host, password, port, secure, username };
}

export { createSmtpContactDelivery, getContactSmtpConfiguration, type ContactSmtpConfiguration };
