import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  getActiveFlightsContexts,
  runActiveFlightsCollectors,
  runAirportFlightsCollector,
} from "./collect-podgorica-flights.ts";

test("reports a successful Podgorica Airport cache refresh", async () => {
  const lines: string[] = [];
  const result = await runAirportFlightsCollector({
    cachePath: "/tmp/gradom-flights-collector-success/flights.json",
    refresh: async () => ({
      acceptedFlights: 3,
      retainedPreviousSnapshot: false,
      snapshot: null,
      success: true,
      warnings: [],
    }),
    writeOutput: (line) => lines.push(line),
  });

  assert.equal(result.exitCode, 0);
  assert.equal(result.state, "success");
  assert.equal(result.cityId, "podgorica");
  assert.deepEqual(lines, [
    "provider=montenegro-airports-flights cityId=podgorica state=success accepted=3 cache=written cache_path=/tmp/gradom-flights-collector-success/flights.json",
  ]);
});

test("returns a non-zero result when no cache can be retained", async () => {
  const result = await runAirportFlightsCollector({
    cachePath: "/tmp/gradom-flights-collector-failure/flights.json",
    refresh: async () => ({
      acceptedFlights: 0,
      errorCode: "airport-flights-parser-failed",
      retainedPreviousSnapshot: false,
      snapshot: null,
      success: false,
      warnings: ["tables unavailable"],
    }),
    writeOutput: () => undefined,
  });

  assert.equal(result.exitCode, 1);
  assert.equal(result.state, "failed");
  assert.equal(
    result.output,
    "provider=montenegro-airports-flights cityId=podgorica state=failed accepted=0 cache=unavailable cache_path=/tmp/gradom-flights-collector-failure/flights.json error=airport-flights-parser-failed reason=tables-unavailable",
  );
});

test("never emits a success state when the refresh reports a cache write failure", async () => {
  const lines: string[] = [];
  const result = await runAirportFlightsCollector({
    cachePath: "/tmp/gradom-flights-collector-cache-write-failure/flights.json",
    refresh: async () => ({
      acceptedFlights: 0,
      errorCode: "airport-flights-cache-write-failed",
      retainedPreviousSnapshot: false,
      snapshot: null,
      success: false,
      warnings: [],
    }),
    writeOutput: (line) => lines.push(line),
  });

  assert.equal(result.exitCode, 1);
  assert.equal(result.state, "failed");
  assert.deepEqual(lines, [
    "provider=montenegro-airports-flights cityId=podgorica state=failed accepted=0 cache=unavailable cache_path=/tmp/gradom-flights-collector-cache-write-failure/flights.json error=airport-flights-cache-write-failed",
  ]);
});

test("collects every active city with Flights capability and an approved airport source", () => {
  const contexts = getActiveFlightsContexts();

  assert.deepEqual(
    contexts.map((context) => context.city.id),
    ["podgorica", "tivat"],
  );
});

test("keeps each active airport result independent when one city refresh fails", async () => {
  const results = await runActiveFlightsCollectors({
    runCollector: async (context) => ({
      cityId: context.city.id,
      exitCode: context.city.id === "tivat" ? 1 : 0,
      output: "",
      refresh: null,
      state: context.city.id === "tivat" ? "failed" : "success",
    }),
  });

  assert.deepEqual(
    results.map(({ cityId, state }) => ({ cityId, state })),
    [
      { cityId: "podgorica", state: "success" },
      { cityId: "tivat", state: "failed" },
    ],
  );
});

test("uses distinct city locks for concurrent Podgorica and Tivat refreshes", async () => {
  const directory = await mkdtemp(join(tmpdir(), "airport-flights-locks-"));
  let releasePodgorica: (() => void) | undefined;
  let startPodgorica: (() => void) | undefined;
  const podgoricaStarted = new Promise<void>((resolve) => {
    startPodgorica = resolve;
  });
  const podgoricaRefresh = new Promise<void>((resolve) => {
    releasePodgorica = resolve;
  });

  const podgorica = runAirportFlightsCollector({
    cachePath: join(directory, "podgorica-flights.json"),
    refresh: async () => {
      startPodgorica?.();
      await podgoricaRefresh;
      return {
        acceptedFlights: 1,
        retainedPreviousSnapshot: false,
        snapshot: null,
        success: true,
        warnings: [],
      };
    },
    writeOutput: () => undefined,
  });
  await podgoricaStarted;

  const tivat = await runAirportFlightsCollector({
    cachePath: join(directory, "tivat-flights.json"),
    cityId: "tivat",
    refresh: async () => ({
      acceptedFlights: 1,
      retainedPreviousSnapshot: false,
      snapshot: null,
      success: true,
      warnings: [],
    }),
    writeOutput: () => undefined,
  });
  releasePodgorica?.();
  const completedPodgorica = await podgorica;

  assert.equal(tivat.state, "success");
  assert.equal(completedPodgorica.state, "success");
});
