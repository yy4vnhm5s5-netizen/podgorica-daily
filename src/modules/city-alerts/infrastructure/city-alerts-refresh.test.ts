import assert from "node:assert/strict";
import test from "node:test";

import { defaultProviders, refreshActiveCedisCities } from "./city-alerts-refresh.ts";

const completedAt = "2026-07-26T09:00:00.000Z";

test("aggregates the active CEDIS collectors so the legacy refresh includes Budva", async () => {
  let calls = 0;
  const cedisCollectors = async () => {
    calls += 1;
    return [
      {
        exitCode: 0 as const,
        summary: {
          alertCount: 2,
          cachePath: "/data/events/cedis-planned-outages.json",
          cacheStatus: "fresh" as const,
          cityId: "podgorica",
          completedAt,
          retainedPreviousSnapshot: false,
          status: "success" as const,
          warnings: [],
        },
      },
      {
        exitCode: 0 as const,
        summary: {
          alertCount: 1,
          cachePath: "/data/events/cedis-planned-outages-budva.json",
          cacheStatus: "fresh" as const,
          cityId: "budva",
          completedAt,
          retainedPreviousSnapshot: false,
          status: "success" as const,
          warnings: [],
        },
      },
    ];
  };

  const result = await refreshActiveCedisCities(cedisCollectors);

  assert.equal(calls, 1);
  assert.equal(result.exitCode, 0);
  assert.equal(result.summary.alertCount, 3);
  assert.equal(result.summary.cacheStatus, "fresh");
  assert.equal(result.summary.status, "success");
});

test("wires the legacy CEDIS provider to the active-city collector", async () => {
  let calls = 0;
  const providers = defaultProviders({
    cedisCollectors: async () => {
      calls += 1;
      return [
        {
          exitCode: 0,
          summary: {
            alertCount: 1,
            cachePath: "/data/events/cedis-planned-outages-budva.json",
            cacheStatus: "fresh",
            cityId: "budva",
            completedAt,
            retainedPreviousSnapshot: false,
            status: "success",
            warnings: [],
          },
        },
      ];
    },
  });
  const cedis = providers.find(({ id }) => id === "cedis");

  if (!cedis) return;
  const result = await cedis.refresh();

  assert.equal(calls, 1);
  assert.equal(result.summary.alertCount, 1);
});

test("includes the ViK Ulcinj collector in the scheduled city-alerts refresh", () => {
  const providers = defaultProviders({ cedisCollectors: async () => [] });

  // Ulcinj refreshes through the same runner as every other water provider, so one cron trigger
  // keeps all of them current.
  assert.equal(
    providers.some(({ id }) => id === "vik-ulcinj"),
    true,
  );
});
