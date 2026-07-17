import assert from "node:assert/strict";
import test from "node:test";

import type { EventRefreshSummary } from "../../../../../modules/events/infrastructure/events-refresh-runner.ts";
import { createRefreshPostHandler } from "./refresh-post-handler.ts";

const secret = "a-safe-refresh-secret-with-at-least-32";
function summary(state: EventRefreshSummary["state"]): EventRefreshSummary {
  return {
    completedAt: "2026-07-17T12:01:00.000Z",
    providers: [
      {
        acceptedCount: 1,
        durationMs: 0,
        id: "kic",
        retainedPreviousSnapshot: true,
        state: "retained",
      },
    ],
    startedAt: "2026-07-17T12:00:00.000Z",
    state,
  };
}
function request(authorization?: string, url = "https://example.test/api/internal/events/refresh") {
  return new Request(url, {
    body: JSON.stringify({ secret: "body-secret", providerUrl: "https://evil.test" }),
    headers: authorization ? { authorization, cookie: "secret=cookie-secret" } : {},
    method: "POST",
  });
}

test("returns success, partial, retained cache, and overlap statuses from the actual POST handler", async () => {
  for (const [state, status] of [
    ["success", 200],
    ["partial", 207],
    ["already-running", 409],
  ] as const) {
    let calls = 0;
    const post = createRefreshPostHandler({
      refresh: async () => {
        calls++;
        return summary(state);
      },
      secret,
    });
    const response = await post(request(`Bearer ${secret}`));
    assert.equal(response.status, status);
    assert.equal(calls, 1);
    assert.equal((await response.json()).providers[0].retainedPreviousSnapshot, true);
  }
});

test("rejects invalid authorization and ignores query, body, and cookie secrets without executing refresh", async () => {
  for (const authorization of [undefined, "Bearer", "Basic anything", "Bearer wrong-secret"]) {
    let calls = 0;
    const post = createRefreshPostHandler({
      refresh: async () => {
        calls++;
        return summary("success");
      },
      secret,
    });
    assert.equal((await post(request(authorization))).status, 401);
    assert.equal(calls, 0);
  }
  let calls = 0;
  const post = createRefreshPostHandler({
    refresh: async () => {
      calls++;
      return summary("success");
    },
    secret,
  });
  assert.equal(
    (
      await post(
        request(undefined, `https://example.test/api/internal/events/refresh?secret=${secret}`),
      )
    ).status,
    401,
  );
  assert.equal(calls, 0);
});

test("fails closed for invalid configuration and maps unexpected errors to safe output", async () => {
  for (const configuredSecret of [undefined, "   "]) {
    const unavailable = createRefreshPostHandler({
      refresh: async () => summary("success"),
      secret: configuredSecret,
    });
    assert.equal((await unavailable(request(`Bearer ${secret}`))).status, 500);
  }
  const post = createRefreshPostHandler({
    refresh: async () => {
      throw new Error("/private/tmp secret <html> full description");
    },
    secret,
  });
  const response = await post(request(`Bearer ${secret}`));
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { code: "REFRESH_INTERNAL_ERROR", status: "error" });
});
