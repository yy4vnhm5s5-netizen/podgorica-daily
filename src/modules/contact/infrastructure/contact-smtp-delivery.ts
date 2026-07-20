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

  const transporter = nodemailer.createTransport({
    auth:
      configuration.username && configuration.password
        ? { pass: configuration.password, user: configuration.username }
        : undefined,
    host: configuration.host,
    port: configuration.port,
    secure: configuration.secure,
  });

  return {
    async deliver({ inquiry, metadata }) {
      await transporter.sendMail({
        from: configuration.from,
        replyTo: inquiry.email,
        subject: "Gradom — Contact inquiry",
        text: formatContactInquiryMessage(inquiry, metadata),
        to: configuration.contactEmail,
      });
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
