import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { runZpcgRailwayCollector } from "./collect-zpcg-railway.ts";
import type { ZpcgRefreshResult } from "./zpcg-railway.ts";

test("reports a successful ŽPCG collection with a zero exit code", async () => {
  const output: string[] = [];
  const result = await runZpcgRailwayCollector({
    cachePath: await temporaryCachePath(),
    refresh: async () => successfulRefresh(),
    writeOutput: (line) => output.push(line),
  });

  assert.equal(result.exitCode, 0);
  assert.equal(
    output[0],
    "provider=zpcg-railway state=success phase=cache accepted=2 cache=written",
  );
});

test("reports request, parser, and cache failures with a non-zero exit code", async () => {
  for (const phase of ["request", "parser", "cache"] as const) {
    const output: string[] = [];
    const result = await runZpcgRailwayCollector({
      cachePath: await temporaryCachePath(),
      refresh: async () => ({
        acceptedDepartures: 0,
        errorCode: `zpcg-${phase}-failed`,
        phase,
        retainedPreviousSnapshot: phase === "parser",
        snapshot: null,
        success: false,
        warnings: [],
      }),
      writeOutput: (line) => output.push(line),
    });

    assert.equal(result.exitCode, 1);
    assert.match(output[0], new RegExp(`state=failed phase=${phase}`));
    assert.match(output[0], /cache=(retained|unavailable)/);
  }
});

function successfulRefresh(): ZpcgRefreshResult {
  return {
    acceptedDepartures: 2,
    phase: "cache",
    retainedPreviousSnapshot: false,
    snapshot: {
      departures: [],
      fetchedAt: "2026-07-20T08:00:00.000Z",
      freshnessStatus: "fresh",
      lastSuccessfulRefreshAt: "2026-07-20T08:00:00.000Z",
      parserWarnings: [],
      schemaVersion: 1,
      sourceUrl: "https://zpcg.me/red-voznje/ukupno",
      timetableDate: "2026-07-20",
    },
    success: true,
    warnings: [],
  };
}

async function temporaryCachePath(): Promise<string> {
  return join(await mkdtemp(join(tmpdir(), "zpcg-collector-")), "railway.json");
}
