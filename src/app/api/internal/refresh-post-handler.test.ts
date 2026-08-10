import assert from "node:assert/strict";
import test from "node:test";

import { createRefreshPostHandler, getRefreshResponseStatus } from "./refresh-post-handler.ts";

const secret = "a-safe-shared-refresh-handler-secret-32";

function request(authorization?: string) {
  return new Request("https://example.test/api/internal/example/refresh", {
    headers: authorization ? { authorization } : undefined,
    method: "POST",
  });
}

test("success, partial, retained, and an audited-safe upstream-unavailable outcome return HTTP 200", () => {
  for (const state of ["success", "partial", "retained", "upstream-unavailable"] as const) {
    assert.equal(getRefreshResponseStatus(state), 200);
  }
});

test("an in-progress overlapping refresh returns 409, a malformed request returns 400, and unclassified/operational failures fail closed at 500", () => {
  assert.equal(getRefreshResponseStatus("already-running"), 409);
  assert.equal(getRefreshResponseStatus("bad-request"), 400);
  // "unavailable" and "failure" are still ambiguous for every producer except Flights (a cache
  // write or an unexpected exception can be reported the same way as a routine upstream
  // failure) — they must not be assumed safe until that same audit is done for each provider.
  assert.equal(getRefreshResponseStatus("unavailable"), 500);
  assert.equal(getRefreshResponseStatus("failure"), 500);
  assert.equal(getRefreshResponseStatus("operational-failure"), 500);
});

test("an audited upstream-unavailable outcome (e.g. Flights, after its own error-code classification) does not fail the POST handler", async () => {
  const post = createRefreshPostHandler({
    refresh: async () => ({
      acceptedCount: 0,
      errorCode: "airport-flights-request-failed",
      provider: "montenegro-airports-flights",
      retainedPreviousSnapshot: false,
      state: "upstream-unavailable" as const,
      warnings: [],
    }),
    secret,
  });

  const response = await post(request(`Bearer ${secret}`));

  assert.equal(response.status, 200);
  assert.equal((await response.json()).state, "upstream-unavailable");
});

test("an unclassified 'unavailable' outcome from a not-yet-audited provider still fails closed at 500", async () => {
  const post = createRefreshPostHandler({
    refresh: async () => ({
      acceptedCount: 0,
      errorCode: "zpcg-cache-write-failed",
      provider: "zpcg-railway",
      retainedPreviousSnapshot: false,
      state: "unavailable" as const,
      warnings: [],
    }),
    secret,
  });

  const response = await post(request(`Bearer ${secret}`));

  assert.equal(response.status, 500);
});

test("a malformed request (e.g. an unsupported city query parameter) returns 400, not a hidden 200", async () => {
  const post = createRefreshPostHandler({
    refresh: async () => ({
      acceptedCount: 0,
      errorCode: "montegigs-city-unsupported",
      provider: "montegigs-going-out",
      retainedPreviousSnapshot: false,
      state: "bad-request" as const,
      warnings: ["montegigs-city-unsupported"],
    }),
    secret,
  });

  const response = await post(request(`Bearer ${secret}`));

  assert.equal(response.status, 400);
});

test("authentication failures and unhandled exceptions still return their existing status codes", async () => {
  const unauthenticated = createRefreshPostHandler({
    refresh: async () => ({ state: "success" as const }),
    secret,
  });
  assert.equal((await unauthenticated(request())).status, 401);

  const misconfigured = createRefreshPostHandler({
    refresh: async () => ({ state: "success" as const }),
  });
  assert.equal((await misconfigured(request(`Bearer ${secret}`))).status, 500);

  const throwing = createRefreshPostHandler({
    refresh: async () => {
      throw new Error("unexpected");
    },
    secret,
  });
  assert.equal((await throwing(request(`Bearer ${secret}`))).status, 500);
});
