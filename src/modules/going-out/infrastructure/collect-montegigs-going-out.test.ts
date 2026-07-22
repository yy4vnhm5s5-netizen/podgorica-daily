import assert from "node:assert/strict";
import test from "node:test";

import { runMonteGigsGoingOutCollector } from "./collect-montegigs-going-out.ts";

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
  assert.equal(output[0], "provider=montegigs-going-out state=success accepted=6 cache=written");
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
    "provider=montegigs-going-out state=failed accepted=4 cache=retained error=montegigs-parser-failed",
  );
});
