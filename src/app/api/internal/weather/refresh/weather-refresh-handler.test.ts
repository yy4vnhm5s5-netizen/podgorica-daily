import assert from "node:assert/strict";
import test from "node:test";

import { createWeatherRefreshPostHandler } from "./weather-refresh-handler.ts";

test("requires the configured Weather Bearer token and returns one provider-wide result", async () => {
  let calls = 0;
  const post = createWeatherRefreshPostHandler({
    runActiveCollectors: async () => {
      calls += 1;
      return [
        {
          cityId: "bar",
          exitCode: 0,
          output: "",
          refresh: {
            retainedPreviousSnapshot: false,
            snapshot: null,
            success: true,
            warnings: [],
          },
          snapshotState: "fresh",
          state: "success",
        },
      ];
    },
    secret: "w".repeat(32),
  });

  const unauthorized = await post(
    new Request("https://gradom.me/api/internal/weather/refresh", { method: "POST" }),
  );
  assert.equal(unauthorized.status, 401);
  assert.equal(calls, 0);

  const authorized = await post(
    new Request("https://gradom.me/api/internal/weather/refresh", {
      headers: { Authorization: `Bearer ${"w".repeat(32)}` },
      method: "POST",
    }),
  );
  assert.equal(authorized.status, 200);
  assert.deepEqual(await authorized.json(), {
    cities: [
      {
        acceptedCount: 1,
        cityId: "bar",
        provider: "weather",
        retainedPreviousSnapshot: false,
        snapshotState: "fresh",
        state: "success",
        warnings: [],
      },
    ],
    provider: "weather",
    state: "success",
  });
  assert.equal(calls, 1);
});
