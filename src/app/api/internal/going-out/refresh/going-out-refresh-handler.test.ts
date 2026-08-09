import assert from "node:assert/strict";
import test from "node:test";

import { createGoingOutRefreshPostHandler } from "./going-out-refresh-handler.ts";
import type { GoingOutCollectorResult } from "@/modules/going-out/infrastructure/collect-montegigs-going-out";
import type { GoingOutDetailCoverage } from "@/modules/going-out/infrastructure/montegigs-going-out";

const secret = "going-out-refresh-secret-at-least-32-characters";

const defaultDetailCoverage: GoingOutDetailCoverage = {
  addressCount: 1,
  candidateEvents: 2,
  descriptionCount: 1,
  detailCacheHits: 0,
  detailCacheMisses: 2,
  detailCacheStale: 0,
  detailCacheStaleFallbacks: 0,
  detailCacheWriteFailures: 0,
  detailEnrichedEvents: 1,
  detailFetchAttempted: 2,
  detailFetchSucceeded: 2,
  informationUrlCount: 1,
  organizerCount: 1,
};

function request(path = "/api/internal/going-out/refresh", authorization?: string) {
  return new Request(`https://example.test${path}`, {
    headers: authorization ? { authorization } : undefined,
    method: "POST",
  });
}

function collectorResult({
  acceptedEvents = 2,
  cityId,
  detailCoverage,
  retainedPreviousSnapshot = false,
  success = true,
}: {
  acceptedEvents?: number;
  cityId: string;
  detailCoverage?: GoingOutDetailCoverage;
  retainedPreviousSnapshot?: boolean;
  success?: boolean;
}): GoingOutCollectorResult {
  return {
    cityId,
    exitCode: success ? 0 : 1,
    output: "",
    refresh: {
      acceptedEvents,
      ...(detailCoverage ? { detailCoverage } : {}),
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

function alreadyRunningCollectorResult(cityId: string): GoingOutCollectorResult {
  return {
    cityId,
    exitCode: 0,
    output: "",
    refresh: null,
    snapshotState: "not-run",
    state: "already-running",
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

  for (const cityId of ["bar", "podgorica", "budva", "tivat", "kotor", "ulcinj"]) {
    const targeted = await post(
      request(`/api/internal/going-out/refresh?city=${cityId}`, `Bearer ${secret}`),
    );
    assert.equal(targeted.status, 200);
    assert.equal((await targeted.json()).cityId, cityId);
  }
  assert.deepEqual(targetedCities, ["bar", "podgorica", "budva", "tivat", "kotor", "ulcinj"]);
  const supportedCityCount = targetedCities.length;
  assert.equal(activeRefreshes, 0);

  const empty = await post(request("/api/internal/going-out/refresh?city=", `Bearer ${secret}`));
  assert.equal(empty.status, 400);
  assert.equal(targetedCities.length, supportedCityCount);

  const unsupported = await post(
    request("/api/internal/going-out/refresh?city=niksic", `Bearer ${secret}`),
  );
  assert.equal(unsupported.status, 400);
  assert.equal(targetedCities.length, supportedCityCount);
});

test("includes existing detail enrichment coverage in a targeted city refresh", async () => {
  const detailCoverage = {
    ...defaultDetailCoverage,
    addressCount: 3,
    descriptionCount: 2,
  };
  const post = createGoingOutRefreshPostHandler({
    runCollector: async () =>
      collectorResult({ cityId: "kotor", detailCoverage, acceptedEvents: 5 }),
    secret,
  });

  const response = await post(
    request("/api/internal/going-out/refresh?city=kotor", `Bearer ${secret}`),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    acceptedCount: 5,
    cityId: "kotor",
    detailCoverage,
    provider: "montegigs-going-out",
    retainedPreviousSnapshot: false,
    snapshotState: "fresh",
    state: "success",
    warnings: [],
  });
});

test("preserves distinct detail enrichment coverage for every city in a multi-city refresh", async () => {
  const barCoverage = { ...defaultDetailCoverage, candidateEvents: 4, descriptionCount: 3 };
  const budvaCoverage = { ...defaultDetailCoverage, candidateEvents: 7, organizerCount: 4 };
  const post = createGoingOutRefreshPostHandler({
    runActiveCollectors: async () => [
      collectorResult({ cityId: "bar", detailCoverage: barCoverage }),
      collectorResult({ cityId: "budva", detailCoverage: budvaCoverage }),
    ],
    secret,
  });

  const response = await post(request(undefined, `Bearer ${secret}`));
  const body = (await response.json()) as {
    cities: Array<{ cityId: string; detailCoverage?: GoingOutDetailCoverage }>;
    state: string;
  };

  assert.equal(response.status, 200);
  assert.equal(body.state, "success");
  assert.deepEqual(
    body.cities.map(({ cityId, detailCoverage: coverage }) => ({
      cityId,
      detailCoverage: coverage,
    })),
    [
      { cityId: "bar", detailCoverage: barCoverage },
      { cityId: "budva", detailCoverage: budvaCoverage },
    ],
  );
});

test("does not fabricate coverage when a Going Out refresh did not run", async () => {
  const post = createGoingOutRefreshPostHandler({
    runCollector: async () => alreadyRunningCollectorResult("kotor"),
    secret,
  });

  const response = await post(
    request("/api/internal/going-out/refresh?city=kotor", `Bearer ${secret}`),
  );
  const body = (await response.json()) as Record<string, unknown>;

  assert.equal(response.status, 409);
  assert.equal(body.state, "already-running");
  assert.equal("detailCoverage" in body, false);
});

test("preserves reported coverage for retained snapshots and omits it for unavailable refreshes", async () => {
  const retainedCoverage = { ...defaultDetailCoverage, detailFetchAttempted: 4 };
  const retainedPost = createGoingOutRefreshPostHandler({
    runCollector: async () =>
      collectorResult({
        cityId: "budva",
        detailCoverage: retainedCoverage,
        retainedPreviousSnapshot: true,
        success: false,
      }),
    secret,
  });
  const unavailablePost = createGoingOutRefreshPostHandler({
    runCollector: async () => collectorResult({ cityId: "budva", success: false }),
    secret,
  });

  const retainedResponse = await retainedPost(
    request("/api/internal/going-out/refresh?city=budva", `Bearer ${secret}`),
  );
  const retainedBody = (await retainedResponse.json()) as Record<string, unknown>;
  const unavailableResponse = await unavailablePost(
    request("/api/internal/going-out/refresh?city=budva", `Bearer ${secret}`),
  );
  const unavailableBody = (await unavailableResponse.json()) as Record<string, unknown>;

  assert.equal(retainedResponse.status, 200);
  assert.equal(retainedBody.state, "retained");
  assert.deepEqual(retainedBody.detailCoverage, retainedCoverage);
  assert.equal(unavailableResponse.status, 500);
  assert.equal(unavailableBody.state, "unavailable");
  assert.equal("detailCoverage" in unavailableBody, false);
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
  assert.equal("detailCoverage" in body.cities[1]!, false);
});
