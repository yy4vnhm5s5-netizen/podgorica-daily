import {
  ContactDeliveryUnavailableError,
  type ContactInquiryDelivery,
} from "@/modules/contact/application/submit-contact-inquiry";
import { formatContactInquiryMessage } from "@/modules/contact/application/contact-email-message";

// Railway Hobby blocks outbound SMTP, so contact delivery goes through Resend's HTTPS API
// instead. Zoho remains the receiving mailbox (CONTACT_EMAIL) — only the outbound sending path
// changed, not who receives the inquiry.
const resendApiUrl = "https://api.resend.com/emails";
const contactEmailSubject = "Gradom — Contact inquiry";
const defaultDeliveryTimeoutMs = 10_000;

interface ContactResendConfiguration {
  apiKey: string;
  contactEmail: string;
  fromEmail: string;
}

interface ContactResendDeliveryOptions {
  fetchImplementation?: typeof fetch;
  timeoutMs?: number;
}

function getContactResendConfiguration({
  apiKey,
  contactEmail,
  fromEmail,
}: {
  apiKey?: string;
  contactEmail?: string;
  fromEmail?: string;
}): ContactResendConfiguration | undefined {
  if (!apiKey || !contactEmail || !fromEmail) return undefined;

  return { apiKey, contactEmail, fromEmail };
}

function createResendContactDelivery(
  configuration: ContactResendConfiguration | undefined,
  { fetchImplementation = fetch, timeoutMs = defaultDeliveryTimeoutMs }: ContactResendDeliveryOptions = {},
): ContactInquiryDelivery {
  if (!configuration) {
    return {
      async deliver() {
        throw new ContactDeliveryUnavailableError();
      },
    };
  }

  return {
    async deliver({ inquiry, metadata }) {
      // Safe diagnostics only — never the API key, the formatted message body, or the
      // submitter's email/message content.
      console.log("[contact] delivery started");

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      let response: Response;
      try {
        response = await fetchImplementation(resendApiUrl, {
          body: JSON.stringify({
            from: configuration.fromEmail,
            reply_to: inquiry.email,
            subject: contactEmailSubject,
            text: formatContactInquiryMessage(inquiry, metadata),
            to: [configuration.contactEmail],
          }),
          headers: {
            authorization: `Bearer ${configuration.apiKey}`,
            "content-type": "application/json",
          },
          method: "POST",
          signal: controller.signal,
        });
      } catch (error) {
        const isTimeout = error instanceof Error && error.name === "AbortError";
        console.error("[contact] delivery failed", {
          reason: isTimeout ? "timeout" : "network-error",
        });
        throw new Error("Contact delivery request failed.", { cause: error });
      } finally {
        clearTimeout(timeoutId);
      }

      if (!response.ok) {
        const providerErrorName = await readProviderErrorName(response);
        console.error("[contact] delivery failed", {
          providerErrorName,
          status: response.status,
        });
        throw new Error(`Resend delivery failed with status ${response.status}.`);
      }

      console.log("[contact] delivery succeeded");
    },
  };
}

// Resend's error responses look like { name: "validation_error", message: "..." } — the `name`
// is a short, stable provider-defined code (safe to log), never user-submitted content.
async function readProviderErrorName(response: Response): Promise<string | undefined> {
  try {
    const body: unknown = await response.json();
    return isRecord(body) && typeof body.name === "string" ? body.name : undefined;
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export {
  createResendContactDelivery,
  getContactResendConfiguration,
  type ContactResendConfiguration,
  type ContactResendDeliveryOptions,
};
