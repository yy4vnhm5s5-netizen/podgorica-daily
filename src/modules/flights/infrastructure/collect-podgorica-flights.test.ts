import assert from "node:assert/strict";
import test from "node:test";

import { runPodgoricaFlightsCollector } from "./collect-podgorica-flights.ts";

test("reports a successful Podgorica Airport cache refresh", async () => {
  const lines: string[] = [];
  const result = await runPodgoricaFlightsCollector({
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
  assert.deepEqual(lines, [
    "provider=podgorica-airport state=success accepted=3 cache=written cache_path=/tmp/gradom-flights-collector-success/flights.json",
  ]);
});

test("returns a non-zero result when no cache can be retained", async () => {
  const result = await runPodgoricaFlightsCollector({
    cachePath: "/tmp/gradom-flights-collector-failure/flights.json",
    refresh: async () => ({
      acceptedFlights: 0,
      errorCode: "podgorica-flights-parser-failed",
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
    "provider=podgorica-airport state=failed accepted=0 cache=unavailable cache_path=/tmp/gradom-flights-collector-failure/flights.json error=podgorica-flights-parser-failed reason=tables-unavailable",
  );
});

test("never emits a success state when the refresh reports a cache write failure", async () => {
  const lines: string[] = [];
  const result = await runPodgoricaFlightsCollector({
    cachePath: "/tmp/gradom-flights-collector-cache-write-failure/flights.json",
    refresh: async () => ({
      acceptedFlights: 0,
      errorCode: "podgorica-flights-cache-write-failed",
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
    "provider=podgorica-airport state=failed accepted=0 cache=unavailable cache_path=/tmp/gradom-flights-collector-cache-write-failure/flights.json error=podgorica-flights-cache-write-failed",
  ]);
});
