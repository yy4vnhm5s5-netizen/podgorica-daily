import {
  hasCompletedContactHoneypot,
  parseContactInquiry,
  type ContactInquiry,
  type ContactInquiryFieldErrors,
} from "../domain/contact-inquiry.ts";
import type { ContactSubmissionMetadata } from "./contact-email-message.ts";

interface ContactInquiryDelivery {
  deliver(request: ContactInquiryDeliveryRequest): Promise<void>;
}

interface ContactInquiryDeliveryRequest {
  inquiry: ContactInquiry;
  metadata: ContactSubmissionMetadata;
}

interface ContactRateLimiter {
  consume(clientId: string, now: number): { allowed: boolean; retryAfterSeconds?: number };
}

class ContactDeliveryUnavailableError extends Error {
  constructor() {
    super("Contact delivery is not configured.");
    this.name = "ContactDeliveryUnavailableError";
  }
}

type ContactSubmissionResult =
  | { status: "success" }
  | { status: "rejected" }
  | { fieldErrors: ContactInquiryFieldErrors; status: "invalid" }
  | { retryAfterSeconds: number; status: "rate-limited" }
  | { status: "delivery-unavailable" }
  | { status: "delivery-failed" };

async function submitContactInquiry({
  clientId,
  clientIp,
  delivery,
  input,
  now = Date.now(),
  rateLimiter,
  userAgent,
}: {
  clientId: string;
  clientIp?: string;
  delivery: ContactInquiryDelivery;
  input: unknown;
  now?: number;
  rateLimiter: ContactRateLimiter;
  userAgent?: string;
}): Promise<ContactSubmissionResult> {
  if (isRecord(input) && hasCompletedContactHoneypot(input.website)) return { status: "rejected" };

  const parsed = parseContactInquiry(input);
  if (!parsed.success) return { fieldErrors: parsed.fieldErrors, status: "invalid" };

  const rateLimit = rateLimiter.consume(clientId, now);
  if (!rateLimit.allowed) {
    return { retryAfterSeconds: rateLimit.retryAfterSeconds ?? 60, status: "rate-limited" };
  }

  try {
    await delivery.deliver({
      inquiry: parsed.inquiry,
      metadata: {
        ...(clientIp ? { clientIp } : {}),
        submittedAt: new Date(now).toISOString(),
        ...(userAgent ? { userAgent } : {}),
      },
    });
    return { status: "success" };
  } catch (error) {
    if (error instanceof ContactDeliveryUnavailableError) return { status: "delivery-unavailable" };
    return { status: "delivery-failed" };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export {
  ContactDeliveryUnavailableError,
  submitContactInquiry,
  type ContactInquiryDelivery,
  type ContactInquiryDeliveryRequest,
  type ContactSubmissionResult,
};
