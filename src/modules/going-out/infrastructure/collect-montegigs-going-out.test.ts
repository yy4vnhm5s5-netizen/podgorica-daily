import assert from "node:assert/strict";
import test from "node:test";

import {
  getActiveMonteGigsGoingOutContexts,
  runActiveMonteGigsGoingOutCollectors,
  runMonteGigsGoingOutCollector,
} from "./collect-montegigs-going-out.ts";
import { createCityContext } from "@/shared/config/cities";

test("reports a successful MonteGigs collection with a cache write", async () => {
  const output: string[] = [];
  const result = await runMonteGigsGoingOutCollector({
    cachePath: "/tmp/gradom-going-out-collector-success/cache.json",
    refresh: async () => ({
      acceptedEvents: 6,
      retainedPreviousSnapshot: false,
      snapshot: null,
      success: true,
      warnings: [],
    }),
    writeOutput: (line) => output.push(line),
  });

  assert.equal(result.exitCode, 0);
  assert.equal(
    output[0],
    "provider=montegigs-going-out cityId=podgorica state=success accepted=6 snapshot=unavailable retainedPreviousSnapshot=false",
  );
});

test("reports retained cache on a failed MonteGigs collection", async () => {
  const output: string[] = [];
  const result = await runMonteGigsGoingOutCollector({
    cachePath: "/tmp/gradom-going-out-collector-failure/cache.json",
    refresh: async () => ({
      acceptedEvents: 4,
      errorCode: "montegigs-parser-failed",
      retainedPreviousSnapshot: true,
      snapshot: null,
      success: false,
      warnings: [],
    }),
    writeOutput: (line) => output.push(line),
  });

  assert.equal(result.exitCode, 1);
  assert.equal(
    output[0],
    "provider=montegigs-going-out cityId=podgorica state=failed accepted=4 snapshot=unavailable retainedPreviousSnapshot=true error=montegigs-parser-failed",
  );
});

test("uses independent city locks and reports city-aware diagnostics", async () => {
  const podgorica = createCityContext("podgorica");
  const budva = createCityContext("budva");
  let finishPodgorica: (() => void) | undefined;
  let signalPodgoricaRefreshStarted: (() => void) | undefined;
  const podgoricaRefreshStarted = new Promise<void>((resolve) => {
    signalPodgoricaRefreshStarted = resolve;
  });
  const pendingPodgorica = runMonteGigsGoingOutCollector({
    cachePath: "/tmp/gradom-going-out-city-locks/podgorica.json",
    context: podgorica,
    refresh: () =>
      new Promise((resolve) => {
        signalPodgoricaRefreshStarted?.();
        finishPodgorica = () =>
          resolve({
            acceptedEvents: 1,
            retainedPreviousSnapshot: false,
            snapshot: null,
            success: true,
            warnings: [],
          });
      }),
  });

  await podgoricaRefreshStarted;

  const duplicate = await runMonteGigsGoingOutCollector({
    cachePath: "/tmp/gradom-going-out-city-locks/podgorica.json",
    context: podgorica,
  });
  const budvaOutput: string[] = [];
  const independentBudva = await runMonteGigsGoingOutCollector({
    cachePath: "/tmp/gradom-going-out-city-locks/budva.json",
    context: budva,
    refresh: async () => ({
      acceptedEvents: 2,
      retainedPreviousSnapshot: false,
      snapshot: null,
      success: true,
      warnings: [],
    }),
    writeOutput: (line) => budvaOutput.push(line),
  });

  assert.equal(duplicate.state, "already-running");
  assert.equal(independentBudva.state, "success");
  assert.match(budvaOutput[0]!, /provider=montegigs-going-out cityId=budva/u);
  finishPodgorica?.();
  await pendingPodgorica;
});

test("sequentially refreshes every active city with an approved Going Out source", async () => {
  const podgorica = createCityContext("podgorica");
  const budva = createCityContext("budva");
  const calls: string[] = [];

  const results = await runActiveMonteGigsGoingOutCollectors({
    cities: [
      podgorica.city,
      { ...budva.city, isActive: true },
      { ...budva.city, capabilities: [], id: "unsupported", slug: "unsupported" },
    ],
    createContext(cityId) {
      return cityId === "budva" ? budva : podgorica;
    },
    async runCollector(context) {
      calls.push(context.city.id);
      return {
        cityId: context.city.id,
        exitCode: 0,
        output: "",
        refresh: null,
        snapshotState: "not-run",
        state: "success",
      };
    },
  });

  assert.deepEqual(calls, ["podgorica", "budva"]);
  assert.deepEqual(
    results.map(({ cityId }) => cityId),
    ["podgorica", "budva"],
  );
});

test("derives the current active Going Out city set from the shared registry", () => {
  const cityIds = getActiveMonteGigsGoingOutContexts()
    .map((context) => context.city.id)
    .sort();

  assert.deepEqual(cityIds, ["budva", "kotor", "podgorica", "tivat"]);
});

test("keeps a failed city independent from successful active-city collector results", async () => {
  const podgorica = createCityContext("podgorica");
  const budva = createCityContext("budva");
  const results = await runActiveMonteGigsGoingOutCollectors({
    cities: [podgorica.city, budva.city],
    createContext: (cityId) => (cityId === "budva" ? budva : podgorica),
    runCollector: async (context) => ({
      cityId: context.city.id,
      exitCode: context.city.id === "budva" ? 1 : 0,
      output: "",
      refresh: null,
      snapshotState: "not-run",
      state: context.city.id === "budva" ? "failed" : "success",
    }),
  });

  assert.deepEqual(
    results.map(({ cityId, state }) => ({ cityId, state })),
    [
      { cityId: "podgorica", state: "success" },
      { cityId: "budva", state: "failed" },
    ],
  );
});
