import assert from "node:assert/strict";
import test from "node:test";

import { createVodovodKotorRefreshPostHandler } from "./route.ts";

const token = "internal-refresh-token-at-least-32-characters";

function request(authorization?: string) {
  return new Request("https://example.test/api/internal/vodovod-kotor/refresh", {
    headers: authorization ? { authorization } : undefined,
    method: "POST",
  });
}

test("uses the shared Bearer-token refresh handler for Vodovod Kotor", async () => {
  let collectorCalls = 0;
  const post = createVodovodKotorRefreshPostHandler({
    runCollector: async () => {
      collectorCalls += 1;
      return {
        exitCode: 0,
        summary: {
          alertCount: 2,
          cachePath: "/private/runtime/vodovod-kotor-water-alerts.json",
          cacheStatus: "fresh",
          cityId: "kotor",
          completedAt: "2026-08-01T10:00:00.000Z",
          retainedPreviousSnapshot: false,
          status: "success",
          warnings: [],
        },
      };
    },
    token,
  });

  assert.equal((await post(request())).status, 401);
  assert.equal((await post(request("Bearer incorrect-token"))).status, 401);
  assert.equal(collectorCalls, 0);

  const response = await post(request(`Bearer ${token}`));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    acceptedCount: 2,
    cityId: "kotor",
    provider: "vodovod-kotor",
    retainedPreviousSnapshot: false,
    state: "success",
    warnings: [],
  });
  assert.equal(collectorCalls, 1);
});
