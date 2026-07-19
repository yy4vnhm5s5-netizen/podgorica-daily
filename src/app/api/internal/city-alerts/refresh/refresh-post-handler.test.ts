import assert from "node:assert/strict";
import test from "node:test";

import { createRefreshPostHandler } from "./refresh-post-handler.ts";

const secret = "a-safe-city-alerts-refresh-secret-32";

function request(authorization?: string) {
  return new Request("https://example.test/api/internal/city-alerts/refresh", {
    headers: authorization ? { authorization } : undefined,
    method: "POST",
  });
}

function summary(state: "already-running" | "failure" | "partial" | "success") {
  return {
    completedAt: "2026-07-19T09:01:00.000Z",
    providers: [
      {
        alertCount: 0,
        attempted: true as const,
        cacheStatus: "fresh" as const,
        provider: "cedis" as const,
        retainedPreviousCache: false,
        state: "success" as const,
        success: true,
        warnings: [],
      },
    ],
    startedAt: "2026-07-19T09:00:00.000Z",
    state,
  };
}

test("rejects unauthenticated city-alert refresh requests", async () => {
  let refreshes = 0;
  const post = createRefreshPostHandler({
    refresh: async () => {
      refreshes += 1;
      return summary("success");
    },
    secret,
  });

  const response = await post(request());
  assert.equal(response.status, 401);
  assert.equal(refreshes, 0);
});

test("rejects an incorrect city-alert refresh secret", async () => {
  let refreshes = 0;
  const post = createRefreshPostHandler({
    refresh: async () => {
      refreshes += 1;
      return summary("success");
    },
    secret,
  });

  const response = await post(request("Bearer incorrect-secret"));
  assert.equal(response.status, 401);
  assert.equal(refreshes, 0);
});

test("returns the safe refresh summary for an authorized request", async () => {
  const post = createRefreshPostHandler({
    refresh: async () => summary("partial"),
    secret,
  });

  const response = await post(request(`Bearer ${secret}`));
  assert.equal(response.status, 207);
  assert.deepEqual(await response.json(), summary("partial"));
});

test("does not enable the endpoint without a configured secret", async () => {
  const post = createRefreshPostHandler({
    refresh: async () => summary("success"),
  });

  const response = await post(request(`Bearer ${secret}`));
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { code: "REFRESH_NOT_CONFIGURED", status: "error" });
});

test("maps retained and unavailable provider outcomes without leaking cache paths", async () => {
  const post = createRefreshPostHandler({
    refresh: async () => ({
      ...summary("partial"),
      providers: [
        {
          alertCount: 1,
          attempted: true,
          cacheStatus: "stale",
          errorCode: "vikpg-request-failed",
          provider: "vikpg",
          retainedPreviousCache: true,
          state: "retained",
          success: false,
          warnings: ["upstream-unavailable"],
        },
        {
          alertCount: 0,
          attempted: true,
          cacheStatus: "unavailable",
          errorCode: "cedis-request-failed",
          provider: "cedis",
          retainedPreviousCache: false,
          state: "failed",
          success: false,
          warnings: [],
        },
      ],
    }),
    secret,
  });

  const response = await post(request(`Bearer ${secret}`));
  const body = await response.json();

  assert.equal(response.status, 207);
  assert.equal(body.providers[0].retainedPreviousCache, true);
  assert.equal(body.providers[1].cacheStatus, "unavailable");
  assert.equal(JSON.stringify(body).includes("cachePath"), false);
});
