import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { runVikpgCollector } from "./collect-vikpg.ts";
import type { VikpgRefreshResult } from "./vikpg-refresh.ts";

async function tempCachePath() {
  const directory = await mkdtemp(join(tmpdir(), "collect-vikpg-"));
  return join(directory, "vikpg-water-alerts.json");
}

function refreshResult(overrides: Partial<VikpgRefreshResult> = {}): VikpgRefreshResult {
  return {
    classification: "failed",
    retainedPreviousSnapshot: true,
    snapshot: null,
    success: false,
    warnings: [],
    ...overrides,
  };
}

test("forwards HTTP diagnostics from a failed refresh into the collector summary", async () => {
  let written: string | undefined;
  const result = await runVikpgCollector({
    cachePath: await tempCachePath(),
    refresh: async () =>
      refreshResult({
        diagnostics: {
          finalUrl: "https://vikpg.me/mediji/servisne-informacije/obavjestenja.html",
          httpStatus: 403,
          responseBodyPreview: "Forbidden",
        },
        errorCode: "vikpg-http-error",
      }),
    writeOutput: (line) => {
      written = line;
    },
  });

  assert.deepEqual(result.summary.diagnostics, {
    finalUrl: "https://vikpg.me/mediji/servisne-informacije/obavjestenja.html",
    httpStatus: 403,
    responseBodyPreview: "Forbidden",
  });
  assert.equal(result.summary.errorCode, "vikpg-http-error");
  assert.ok(written);
  const logged = JSON.parse(written);
  assert.equal(logged.diagnostics.httpStatus, 403);
});

test("omits the diagnostics field entirely when a refresh has none to report", async () => {
  const result = await runVikpgCollector({
    cachePath: await tempCachePath(),
    refresh: async () =>
      refreshResult({ errorCode: "cache-read-failed", retainedPreviousSnapshot: false }),
    writeOutput: () => {},
  });

  assert.equal("diagnostics" in result.summary, false);
});

test("collector summary JSON never carries a stack trace, headers, cookies, or a query string", async () => {
  let written: string | undefined;
  await runVikpgCollector({
    cachePath: await tempCachePath(),
    refresh: async () =>
      refreshResult({
        diagnostics: {
          finalUrl: "https://vikpg.me/mediji/servisne-informacije/obavjestenja.html",
          httpStatus: 500,
          responseBodyPreview: "Internal error while rendering the page",
        },
        errorCode: "vikpg-http-error",
      }),
    writeOutput: (line) => {
      written = line;
    },
  });

  assert.ok(written);
  assert.equal(written.includes("at "), false);
  assert.equal(written.toLowerCase().includes("stack"), false);
  assert.equal(written.toLowerCase().includes("cookie"), false);
  assert.equal(written.toLowerCase().includes("header"), false);
  assert.equal(written.includes("?"), false);
});
