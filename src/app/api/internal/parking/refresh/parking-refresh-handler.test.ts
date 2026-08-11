import assert from "node:assert/strict";
import test from "node:test";

import { createParkingRefreshPostHandler } from "./parking-refresh-handler.ts";

test("requires the Parking refresh Bearer token before starting the collector", async () => {
  let calls = 0;
  const post = createParkingRefreshPostHandler({
    runCollectors: async () => {
      calls += 1;
      return [
        {
          cityId: "podgorica",
          exitCode: 0,
          output: "",
          refresh: {
            acceptedLocations: 3,
            retainedPreviousSnapshot: false,
            snapshot: null,
            success: true,
            warnings: ["unknown-parking-id:1"],
          },
          snapshotState: "fresh",
          state: "success",
        },
      ];
    },
    secret: "p".repeat(32),
  });

  const unauthorized = await post(
    new Request("https://gradom.me/api/internal/parking/refresh", { method: "POST" }),
  );
  assert.equal(unauthorized.status, 401);
  assert.equal(calls, 0);

  const authorized = await post(
    new Request("https://gradom.me/api/internal/parking/refresh", {
      headers: { Authorization: `Bearer ${"p".repeat(32)}` },
      method: "POST",
    }),
  );
  assert.equal(authorized.status, 200);
  assert.deepEqual(await authorized.json(), {
    acceptedCount: 3,
    cityId: "podgorica",
    provider: "parking-servis-podgorica",
    retainedPreviousSnapshot: false,
    snapshotState: "fresh",
    state: "success",
    warnings: ["unknown-parking-id:1"],
  });
  assert.equal(calls, 1);
});

test("returns unavailable when the approved collector does not run", async () => {
  const post = createParkingRefreshPostHandler({
    runCollectors: async () => [],
    secret: "p".repeat(32),
  });

  const response = await post(
    new Request("https://gradom.me/api/internal/parking/refresh", {
      headers: { Authorization: `Bearer ${"p".repeat(32)}` },
      method: "POST",
    }),
  );

  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), {
    acceptedCount: 0,
    cityId: "podgorica",
    provider: "parking-servis-podgorica",
    retainedPreviousSnapshot: false,
    state: "unavailable",
    warnings: [],
  });
});
