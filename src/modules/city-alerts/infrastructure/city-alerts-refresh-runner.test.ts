import assert from "node:assert/strict";
import test from "node:test";

import { runCityAlertsRefresh } from "./city-alerts-refresh-runner.ts";

const fixedNow = () => new Date("2026-07-19T09:00:00.000Z");

test("summarizes successful CEDIS and retained VIK refreshes", async () => {
  const result = await runCityAlertsRefresh({
    now: fixedNow,
    providers: [
      {
        id: "cedis",
        refresh: async () => ({
          exitCode: 0,
          summary: { alertCount: 1, retainedPreviousSnapshot: false, status: "success" },
        }),
      },
      {
        id: "vikpg",
        refresh: async () => ({
          exitCode: 0,
          summary: { alertCount: 2, retainedPreviousSnapshot: true, status: "retained" },
        }),
      },
    ],
  });

  assert.equal(result.state, "success");
  assert.deepEqual(result.providers.map(({ state }) => state), ["success", "retained"]);
});

test("keeps provider failures isolated and reports a partial refresh", async () => {
  const result = await runCityAlertsRefresh({
    now: fixedNow,
    providers: [
      {
        id: "cedis",
        refresh: async () => {
          throw new Error("source unavailable");
        },
      },
      {
        id: "vikpg",
        refresh: async () => ({
          exitCode: 0,
          summary: { alertCount: 0, retainedPreviousSnapshot: false, status: "success" },
        }),
      },
    ],
  });

  assert.equal(result.state, "partial");
  assert.deepEqual(result.providers.map(({ state }) => state), ["failed", "success"]);
});

test("reports a locked refresh without treating it as a failed provider", async () => {
  const result = await runCityAlertsRefresh({
    now: fixedNow,
    providers: [
      {
        id: "cedis",
        refresh: async () => ({
          exitCode: 0,
          summary: { alertCount: 0, retainedPreviousSnapshot: false, status: "already-running" },
        }),
      },
    ],
  });

  assert.equal(result.state, "already-running");
  assert.equal(result.providers[0]?.state, "already-running");
});
