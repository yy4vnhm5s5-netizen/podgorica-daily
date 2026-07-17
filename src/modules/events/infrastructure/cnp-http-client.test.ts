import assert from "node:assert/strict";
import test from "node:test";

import { assertCnpUrl, CnpFetchError, createCnpHttpClient } from "./cnp-http-client.ts";

test("fetches approved CNP listing and detail URLs", async () => {
  const requested: string[] = [];
  const client = createCnpHttpClient({
    fetchImplementation: async (url) => ({
      ok: true,
      status: 200,
      text: async () => {
        requested.push(url);
        return "content";
      },
    }),
  });
  assert.equal(await client.get("https://cnp.me/repertoar/"), "content");
  assert.equal(await client.get(new URL("/hamlet/", "https://cnp.me").toString()), "content");
  assert.equal(requested.length, 2);
});

test("rejects off-domain URLs and retries failures", async () => {
  assert.throws(() => assertCnpUrl("https://example.test/event"), CnpFetchError);
  let attempts = 0;
  const client = createCnpHttpClient({
    fetchImplementation: async () => ({
      ok: ++attempts === 2,
      status: 503,
      text: async () => "ok",
    }),
  });
  assert.equal(await client.get("https://cnp.me/repertoar/"), "ok");
  assert.equal(attempts, 2);
});

test("returns typed timeout and exhaustion errors", async () => {
  const timeout = createCnpHttpClient({
    fetchImplementation: async () => {
      const error = new Error("timeout");
      error.name = "AbortError";
      throw error;
    },
  });
  await assert.rejects(
    () => timeout.get("https://cnp.me/repertoar/"),
    (error: unknown) => error instanceof CnpFetchError && error.code === "cnp-request-timeout",
  );
  const failed = createCnpHttpClient({
    fetchImplementation: async () => ({ ok: false, status: 500, text: async () => "" }),
  });
  await assert.rejects(() => failed.get("https://cnp.me/repertoar/"), CnpFetchError);
});
