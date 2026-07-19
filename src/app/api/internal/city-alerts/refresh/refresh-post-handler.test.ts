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

test("rejects unauthenticated city-alert refresh requests", async () => {
  let refreshes = 0;
  const post = createRefreshPostHandler({
    refresh: async () => {
      refreshes += 1;
      return { state: "success" as const };
    },
    secret,
  });

  const response = await post(request());
  assert.equal(response.status, 401);
  assert.equal(refreshes, 0);
});

test("returns the safe refresh summary for an authorized request", async () => {
  const post = createRefreshPostHandler({
    refresh: async () => ({ state: "partial" as const }),
    secret,
  });

  const response = await post(request(`Bearer ${secret}`));
  assert.equal(response.status, 207);
  assert.deepEqual(await response.json(), { state: "partial" });
});

test("does not enable the endpoint without a configured secret", async () => {
  const post = createRefreshPostHandler({
    refresh: async () => ({ state: "success" as const }),
  });

  const response = await post(request(`Bearer ${secret}`));
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { code: "REFRESH_NOT_CONFIGURED", status: "error" });
});
