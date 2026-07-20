import assert from "node:assert/strict";
import test from "node:test";

import type { ContactInquiryDeliveryRequest } from "../../../modules/contact/application/submit-contact-inquiry.ts";
import { createContactPostHandler } from "./contact-post-handler.ts";

const validInquiry = {
  email: "ana@example.com",
  fullName: "Ana Petrović",
  locale: "me",
  message: "Zanima me saradnja sa Gradom-om.",
};

function request(body: object) {
  return new Request("https://gradom.me/api/contact", {
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      "user-agent": "Gradom Contact Test/1.0",
      "x-forwarded-for": "203.0.113.10",
    },
    method: "POST",
  });
}

test("delivers a valid inquiry and reports success only after delivery completes", async () => {
  const received: ContactInquiryDeliveryRequest[] = [];
  const post = createContactPostHandler({
    delivery: {
      async deliver(delivery) {
        received.push(delivery);
      },
    },
    now: () => 0,
    rateLimiter: allowRequests,
  });

  const response = await post(request(validInquiry));
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { status: "sent" });
  assert.equal(received.length, 1);
  assert.equal(received[0]?.inquiry.email, validInquiry.email);
  assert.deepEqual(received[0]?.metadata, {
    clientIp: "203.0.113.10",
    submittedAt: new Date(0).toISOString(),
    userAgent: "Gradom Contact Test/1.0",
  });
});

test("returns a safe delivery failure without claiming an inquiry was sent", async () => {
  const post = createContactPostHandler({
    delivery: {
      async deliver() {
        throw new Error("SMTP unavailable");
      },
    },
    rateLimiter: allowRequests,
  });

  const response = await post(request(validInquiry));
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { code: "DELIVERY_FAILED", status: "error" });
});

test("rejects a completed honeypot without invoking delivery", async () => {
  let deliveries = 0;
  const post = createContactPostHandler({
    delivery: {
      async deliver() {
        deliveries++;
      },
    },
    rateLimiter: allowRequests,
  });

  const response = await post(request({ ...validInquiry, website: "https://bot.example" }));
  assert.equal(response.status, 400);
  assert.equal(deliveries, 0);
});

test("returns field errors and rate-limit responses without delivery", async () => {
  const post = createContactPostHandler({
    delivery: {
      async deliver() {
        throw new Error("must not deliver");
      },
    },
    rateLimiter: { consume: () => ({ allowed: false, retryAfterSeconds: 60 }) },
  });
  const rateLimited = await post(request(validInquiry));
  assert.equal(rateLimited.status, 429);
  assert.equal(rateLimited.headers.get("Retry-After"), "60");

  const validationPost = createContactPostHandler({
    delivery: {
      async deliver() {
        throw new Error("must not deliver");
      },
    },
    rateLimiter: allowRequests,
  });
  const invalid = await validationPost(request({ locale: "me" }));
  assert.equal(invalid.status, 422);
  assert.equal((await invalid.json()).code, "VALIDATION_ERROR");
});

const allowRequests = { consume: () => ({ allowed: true }) };
