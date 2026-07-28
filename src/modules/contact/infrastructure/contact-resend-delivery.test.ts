import assert from "node:assert/strict";
import test from "node:test";

import { ContactDeliveryUnavailableError } from "../application/submit-contact-inquiry.ts";
import {
  createResendContactDelivery,
  getContactResendConfiguration,
} from "./contact-resend-delivery.ts";

const configuration = getContactResendConfiguration({
  apiKey: "test-resend-api-key",
  contactEmail: "kontakt@gradom.me",
  fromEmail: "kontakt@gradom.me",
});

const inquiry = {
  email: "guest@example.com",
  message: "Hello there.",
  name: "Guest User",
};

const metadata = { submittedAt: "2026-07-28T10:00:00.000Z" };

test("sends the correct from, to, reply-to and subject on successful delivery", async () => {
  let capturedUrl: string | RequestInfo | URL | undefined;
  let capturedInit: RequestInit | undefined;

  const fetchImplementation = (async (url: string | RequestInfo | URL, init?: RequestInit) => {
    capturedUrl = url;
    capturedInit = init;
    return new Response(JSON.stringify({ id: "email-1" }), { status: 200 });
  }) as typeof fetch;

  const delivery = createResendContactDelivery(configuration, { fetchImplementation });

  await delivery.deliver({ inquiry, metadata });

  assert.equal(capturedUrl, "https://api.resend.com/emails");
  assert.equal(capturedInit?.method, "POST");

  const headers = capturedInit?.headers as Record<string, string>;
  assert.equal(headers.authorization, "Bearer test-resend-api-key");

  const body = JSON.parse(capturedInit?.body as string) as {
    from: string;
    reply_to: string;
    subject: string;
    text: string;
    to: string[];
  };
  assert.equal(body.from, "kontakt@gradom.me");
  assert.deepEqual(body.to, ["kontakt@gradom.me"]);
  assert.equal(body.reply_to, "guest@example.com");
  assert.equal(body.subject, "Gradom — Contact inquiry");
  assert.match(body.text, /Guest User/);
});

test("throws without leaking provider error details when Resend rejects the request", async () => {
  const fetchImplementation = (async () =>
    new Response(JSON.stringify({ message: "Invalid `from` field.", name: "validation_error" }), {
      status: 422,
    })) as typeof fetch;

  const delivery = createResendContactDelivery(configuration, { fetchImplementation });

  await assert.rejects(delivery.deliver({ inquiry, metadata }), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.doesNotMatch(error.message, /Invalid `from` field/);
    return true;
  });
});

test("aborts and rejects when the request exceeds the configured timeout", async () => {
  const fetchImplementation = ((_url: string | RequestInfo | URL, init?: RequestInit) => {
    return new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        reject(new DOMException("Aborted", "AbortError"));
      });
    });
  }) as typeof fetch;

  const delivery = createResendContactDelivery(configuration, {
    fetchImplementation,
    timeoutMs: 5,
  });

  await assert.rejects(delivery.deliver({ inquiry, metadata }));
});

test("throws ContactDeliveryUnavailableError when configuration is missing", async () => {
  const delivery = createResendContactDelivery(undefined);

  await assert.rejects(delivery.deliver({ inquiry, metadata }), ContactDeliveryUnavailableError);
});

test("getContactResendConfiguration returns undefined when any value is missing", () => {
  assert.equal(
    getContactResendConfiguration({ apiKey: "key", contactEmail: "a@b.com" }),
    undefined,
  );
  assert.ok(
    getContactResendConfiguration({
      apiKey: "key",
      contactEmail: "a@b.com",
      fromEmail: "c@d.com",
    }),
  );
});
