import type { ContactInquiryDelivery } from "../../../modules/contact/application/submit-contact-inquiry.ts";
import {
  submitContactInquiry,
  type ContactSubmissionResult,
} from "../../../modules/contact/application/submit-contact-inquiry.ts";

interface ContactPostHandlerDependencies {
  delivery: ContactInquiryDelivery;
  now?: () => number;
  rateLimiter: {
    consume(clientId: string, now: number): { allowed: boolean; retryAfterSeconds?: number };
  };
}

function createContactPostHandler({
  delivery,
  now = Date.now,
  rateLimiter,
}: ContactPostHandlerDependencies) {
  return async function post(request: Request) {
    const payload = await readJsonBody(request);
    if (!payload.success)
      return Response.json({ code: "INVALID_REQUEST", status: "error" }, { status: 400 });

    const clientIp = getClientIp(request);
    const result = await submitContactInquiry({
      clientId: clientIp ?? "anonymous",
      clientIp,
      delivery,
      input: payload.value,
      now: now(),
      rateLimiter,
      userAgent: normalizeRequestMetadata(request.headers.get("user-agent")),
    });
    return responseForSubmission(result);
  };
}

async function readJsonBody(
  request: Request,
): Promise<{ success: true; value: unknown } | { success: false }> {
  try {
    const body = await request.text();
    if (body.length === 0 || body.length > 16_384) return { success: false };
    return { success: true, value: JSON.parse(body) as unknown };
  } catch {
    return { success: false };
  }
}

function responseForSubmission(result: ContactSubmissionResult) {
  switch (result.status) {
    case "success":
      return Response.json({ status: "sent" }, { status: 201 });
    case "rejected":
      return Response.json({ code: "REQUEST_REJECTED", status: "error" }, { status: 400 });
    case "invalid":
      return Response.json(
        { code: "VALIDATION_ERROR", fields: result.fieldErrors, status: "error" },
        { status: 422 },
      );
    case "rate-limited":
      return Response.json(
        { code: "RATE_LIMITED", status: "error" },
        { headers: { "Retry-After": String(result.retryAfterSeconds) }, status: 429 },
      );
    case "delivery-unavailable":
      return Response.json({ code: "CONTACT_UNAVAILABLE", status: "error" }, { status: 503 });
    case "delivery-failed":
      return Response.json({ code: "DELIVERY_FAILED", status: "error" }, { status: 502 });
  }
}

function getClientIp(request: Request) {
  return normalizeRequestMetadata(
    request.headers.get("x-forwarded-for")?.split(",")[0] ?? request.headers.get("x-real-ip"),
  );
}

function normalizeRequestMetadata(value: string | null | undefined) {
  const normalized = value
    ?.replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return normalized ? normalized.slice(0, 512) : undefined;
}

export { createContactPostHandler };
