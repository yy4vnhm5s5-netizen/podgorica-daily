import assert from "node:assert/strict";
import test from "node:test";

import { createVikpgHttpClient, VikpgFetchError } from "./vikpg-http-client.ts";

const url = "https://vikpg.me/mediji/servisne-informacije/obavjestenja.html";

test("classifies an HTTP 403 as vikpg-http-error with status, finalUrl, and a body preview", async () => {
  const client = createVikpgHttpClient({
    fetchImplementation: async () => ({
      ok: false,
      status: 403,
      text: async () => "<html><body>Forbidden</body></html>",
      url,
    }),
    retries: 0,
  });

  await assert.rejects(
    () => client.get(url),
    (error: unknown) => {
      assert.ok(error instanceof VikpgFetchError);
      assert.equal(error.code, "vikpg-http-error");
      assert.equal(error.httpStatus, 403);
      assert.equal(error.finalUrl, url);
      assert.equal(error.responseBodyPreview, "Forbidden");
      assert.equal(error.emptyBody, undefined);
      assert.equal(error.networkErrorType, undefined);
      return true;
    },
  );
});

test("classifies an HTTP 500 as vikpg-http-error with the response status and preview", async () => {
  const client = createVikpgHttpClient({
    fetchImplementation: async () => ({
      ok: false,
      status: 500,
      text: async () => "Internal Server Error",
      url,
    }),
    retries: 0,
  });

  await assert.rejects(
    () => client.get(url),
    (error: unknown) => {
      assert.ok(error instanceof VikpgFetchError);
      assert.equal(error.code, "vikpg-http-error");
      assert.equal(error.httpStatus, 500);
      assert.equal(error.responseBodyPreview, "Internal Server Error");
      return true;
    },
  );
});

test("classifies an HTTP 200 with an empty body as vikpg-empty-response", async () => {
  const client = createVikpgHttpClient({
    fetchImplementation: async () => ({ ok: true, status: 200, text: async () => "   ", url }),
    retries: 0,
  });

  await assert.rejects(
    () => client.get(url),
    (error: unknown) => {
      assert.ok(error instanceof VikpgFetchError);
      assert.equal(error.code, "vikpg-empty-response");
      assert.equal(error.emptyBody, true);
      assert.equal(error.httpStatus, 200);
      // No preview for a successful-but-empty response — there is nothing meaningful to preview.
      assert.equal(error.responseBodyPreview, undefined);
      return true;
    },
  );
});

test("classifies a network exception as vikpg-network-error with a safe error-type bucket", async () => {
  const client = createVikpgHttpClient({
    fetchImplementation: async () => {
      throw Object.assign(new Error("fetch failed"), {
        cause: Object.assign(new Error("connect ECONNRESET"), { code: "ECONNRESET" }),
      });
    },
    retries: 0,
  });

  await assert.rejects(
    () => client.get(url),
    (error: unknown) => {
      assert.ok(error instanceof VikpgFetchError);
      assert.equal(error.code, "vikpg-network-error");
      assert.equal(error.networkErrorType, "connection-reset");
      assert.equal(error.httpStatus, undefined);
      assert.equal(error.responseBodyPreview, undefined);
      return true;
    },
  );
});

test("classifies an unrecognized network error type as 'unknown' without guessing", async () => {
  const client = createVikpgHttpClient({
    fetchImplementation: async () => {
      throw new Error("something odd happened");
    },
    retries: 0,
  });

  await assert.rejects(
    () => client.get(url),
    (error: unknown) => {
      assert.ok(error instanceof VikpgFetchError);
      assert.equal(error.code, "vikpg-network-error");
      assert.equal(error.networkErrorType, "unknown");
      return true;
    },
  );
});

test("classifies an aborted request as vikpg-request-timeout, distinct from a network error", async () => {
  const client = createVikpgHttpClient({
    fetchImplementation: async () => {
      const error = new Error("The operation was aborted.");
      error.name = "AbortError";
      throw error;
    },
    retries: 0,
  });

  await assert.rejects(
    () => client.get(url),
    (error: unknown) => {
      assert.ok(error instanceof VikpgFetchError);
      assert.equal(error.code, "vikpg-request-timeout");
      assert.equal(error.networkErrorType, undefined);
      return true;
    },
  );
});

test("returns the body normally for a successful response that reports it followed a redirect", async () => {
  const client = createVikpgHttpClient({
    fetchImplementation: async () => ({
      ok: true,
      redirected: true,
      status: 200,
      text: async () => "<main>ok</main>",
      // Simulates what native fetch reports after transparently following a 301: the final,
      // already-resolved URL, distinct from the URL that was requested.
      url: "https://vikpg.me/mediji/servisne-informacije/obavjestenja.html",
    }),
  });

  const body = await client.get(
    "https://vikpg.me/me/mediji/servisne-informacije/obavjestenja.html",
  );

  assert.equal(body, "<main>ok</main>");
});

test("strips a query string from finalUrl but keeps host and path", async () => {
  const client = createVikpgHttpClient({
    fetchImplementation: async () => ({
      ok: false,
      status: 404,
      text: async () => "not found",
      url: "https://vikpg.me/mediji/servisne-informacije/obavjestenja.html?session=abc123&ref=xyz",
    }),
    retries: 0,
  });

  await assert.rejects(
    () => client.get(url),
    (error: unknown) => {
      assert.ok(error instanceof VikpgFetchError);
      assert.equal(
        error.finalUrl,
        "https://vikpg.me/mediji/servisne-informacije/obavjestenja.html",
      );
      assert.equal(error.finalUrl?.includes("session"), false);
      assert.equal(error.finalUrl?.includes("?"), false);
      return true;
    },
  );
});

test("sanitizes the body preview: strips HTML tags, collapses whitespace, and bounds it to 200 characters", async () => {
  const longBody =
    `<html>\n<body>\n  <h1>Error</h1>\n  <p>${"x".repeat(400)}</p>\n</body>\n</html>`;
  const client = createVikpgHttpClient({
    fetchImplementation: async () => ({ ok: false, status: 503, text: async () => longBody, url }),
    retries: 0,
  });

  await assert.rejects(
    () => client.get(url),
    (error: unknown) => {
      assert.ok(error instanceof VikpgFetchError);
      assert.equal(error.responseBodyPreview?.includes("<"), false);
      assert.equal(error.responseBodyPreview?.includes("\n"), false);
      assert.equal(error.responseBodyPreview?.length, 200);
      assert.equal(error.responseBodyPreview, `Error ${"x".repeat(194)}`);
      return true;
    },
  );
});
