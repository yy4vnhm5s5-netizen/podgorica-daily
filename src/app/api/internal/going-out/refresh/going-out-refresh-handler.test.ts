import assert from "node:assert/strict";
import test from "node:test";

import { createGoingOutRefreshPostHandler } from "./going-out-refresh-handler.ts";
import type { GoingOutCollectorResult } from "@/modules/going-out/infrastructure/collect-montegigs-going-out";

const secret = "going-out-refresh-secret-at-least-32-characters";

function request(path = "/api/internal/going-out/refresh", authorization?: string) {
  return new Request(`https://example.test${path}`, {
    headers: authorization ? { authorization } : undefined,
    method: "POST",
  });
}

function collectorResult({
  acceptedEvents = 2,
  cityId,
  retainedPreviousSnapshot = false,
  success = true,
}: {
  acceptedEvents?: number;
  cityId: string;
  retainedPreviousSnapshot?: boolean;
  success?: boolean;
}): GoingOutCollectorResult {
  return {
    cityId,
    exitCode: success ? 0 : 1,
    output: "",
    refresh: {
      acceptedEvents,
      ...(success ? {} : { errorCode: "montegigs-request-failed" }),
      retainedPreviousSnapshot,
      snapshot: null,
      success,
      warnings: [],
    },
    snapshotState: success ? "fresh" : "unavailable",
    state: success ? "success" : "failed",
  };
}

test("refreshes every active approved Going Out city when no city query is supplied", async () => {
  let activeRefreshes = 0;
  let targetedRefreshes = 0;
  const post = createGoingOutRefreshPostHandler({
    runActiveCollectors: async () => {
      activeRefreshes += 1;
      return [
        collectorResult({ cityId: "bar" }),
        collectorResult({ cityId: "podgorica" }),
        collectorResult({ cityId: "budva" }),
        collectorResult({ cityId: "tivat" }),
        collectorResult({ cityId: "kotor" }),
      ];
    },
    runCollector: async () => {
      targetedRefreshes += 1;
      return collectorResult({ cityId: "podgorica" });
    },
    secret,
  });

  assert.equal((await post(request())).status, 401);
  assert.equal(activeRefreshes, 0);

  const response = await post(request(undefined, `Bearer ${secret}`));
  assert.equal(response.status, 200);
  assert.equal(activeRefreshes, 1);
  assert.equal(targetedRefreshes, 0);
  assert.deepEqual(await response.json(), {
    cities: [
      {
        acceptedCount: 2,
        cityId: "bar",
        provider: "montegigs-going-out",
        retainedPreviousSnapshot: false,
        snapshotState: "fresh",
        state: "success",
        warnings: [],
      },
      {
        acceptedCount: 2,
        cityId: "podgorica",
        provider: "montegigs-going-out",
        retainedPreviousSnapshot: false,
        snapshotState: "fresh",
        state: "success",
        warnings: [],
      },
      {
        acceptedCount: 2,
        cityId: "budva",
        provider: "montegigs-going-out",
        retainedPreviousSnapshot: false,
        snapshotState: "fresh",
        state: "success",
        warnings: [],
      },
      {
        acceptedCount: 2,
        cityId: "tivat",
        provider: "montegigs-going-out",
        retainedPreviousSnapshot: false,
        snapshotState: "fresh",
        state: "success",
        warnings: [],
      },
      {
        acceptedCount: 2,
        cityId: "kotor",
        provider: "montegigs-going-out",
        retainedPreviousSnapshot: false,
        snapshotState: "fresh",
        state: "success",
        warnings: [],
      },
    ],
    provider: "montegigs-going-out",
    state: "success",
  });
});

test("preserves an allowlisted targeted refresh and rejects an empty or unsupported city", async () => {
  const targetedCities: string[] = [];
  let activeRefreshes = 0;
  const post = createGoingOutRefreshPostHandler({
    runActiveCollectors: async () => {
      activeRefreshes += 1;
      return [];
    },
    runCollector: async (dependencies) => {
      const cityId = dependencies?.context?.city.id;
      assert.ok(cityId);
      targetedCities.push(cityId);
      return collectorResult({ cityId });
    },
    secret,
  });

  for (const cityId of ["bar", "podgorica", "budva", "tivat", "kotor"]) {
    const targeted = await post(
      request(`/api/internal/going-out/refresh?city=${cityId}`, `Bearer ${secret}`),
    );
    assert.equal(targeted.status, 200);
    assert.equal((await targeted.json()).cityId, cityId);
  }
  assert.deepEqual(targetedCities, ["bar", "podgorica", "budva", "tivat", "kotor"]);
  assert.equal(activeRefreshes, 0);

  const empty = await post(request("/api/internal/going-out/refresh?city=", `Bearer ${secret}`));
  assert.equal(empty.status, 400);
  assert.equal(targetedCities.length, 5);

  const unsupported = await post(
    request("/api/internal/going-out/refresh?city=niksic", `Bearer ${secret}`),
  );
  assert.equal(unsupported.status, 400);
  assert.equal(targetedCities.length, 5);
});

test("keeps successful city outcomes when another city has a routine upstream failure", async () => {
  const post = createGoingOutRefreshPostHandler({
    runActiveCollectors: async () => [
      collectorResult({ acceptedEvents: 4, cityId: "podgorica" }),
      collectorResult({
        acceptedEvents: 0,
        cityId: "budva",
        success: false,
      }),
    ],
    secret,
  });

  const response = await post(request(undefined, `Bearer ${secret}`));
  const body = (await response.json()) as {
    cities: Array<{ acceptedCount: number; cityId: string; state: string }>;
    state: string;
  };
  assert.equal(response.status, 200);
  assert.equal(body.state, "partial");
  assert.deepEqual(
    body.cities.map(({ acceptedCount, cityId, state }) => ({ acceptedCount, cityId, state })),
    [
      { acceptedCount: 4, cityId: "podgorica", state: "success" },
      { acceptedCount: 0, cityId: "budva", state: "unavailable" },
    ],
  );
});
