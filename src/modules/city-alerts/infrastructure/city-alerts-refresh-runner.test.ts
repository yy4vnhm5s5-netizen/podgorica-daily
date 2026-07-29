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

  assert.equal(result.state, "partial");
  assert.deepEqual(
    result.providers.map(({ state }) => state),
    ["success", "retained"],
  );
  assert.deepEqual(result.providers[1], {
    alertCount: 2,
    attempted: true,
    cacheStatus: "stale",
    provider: "vikpg",
    retainedPreviousCache: true,
    state: "retained",
    success: false,
    warnings: [],
  });
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
  assert.deepEqual(
    result.providers.map(({ state }) => state),
    ["failed", "success"],
  );
  assert.equal(result.providers[0]?.cacheStatus, "unavailable");
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
  assert.deepEqual(result.providers[0], {
    alertCount: 0,
    attempted: true,
    cacheStatus: "unavailable",
    provider: "cedis",
    retainedPreviousCache: false,
    state: "already-running",
    success: false,
    warnings: [],
  });
});

// Regression coverage for the production aggregate path: /api/internal/city-alerts/refresh is
// the endpoint Railway cron actually calls (not the per-provider /api/internal/vikpg/refresh),
// so VIKPG's HTTP diagnostics must survive this runner's mapping to be visible in that response.
test("forwards VIKPG's HTTP-error diagnostics (httpStatus, finalUrl, responseBodyPreview) through the aggregate result", async () => {
  const result = await runCityAlertsRefresh({
    now: fixedNow,
    providers: [
      {
        id: "vikpg",
        refresh: async () => ({
          exitCode: 1,
          summary: {
            alertCount: 1,
            diagnostics: {
              finalUrl: "https://vikpg.me/mediji/servisne-informacije/obavjestenja.html",
              httpStatus: 403,
              responseBodyPreview: "Forbidden",
            },
            errorCode: "vikpg-http-error",
            retainedPreviousSnapshot: true,
            status: "retained",
          },
        }),
      },
    ],
  });

  assert.deepEqual(result.providers[0]?.diagnostics, {
    finalUrl: "https://vikpg.me/mediji/servisne-informacije/obavjestenja.html",
    httpStatus: 403,
    responseBodyPreview: "Forbidden",
  });
  assert.equal(result.providers[0]?.errorCode, "vikpg-http-error");
  // Retain semantics are exactly as before this change: retained snapshot, provider-level
  // "retained" state, overall "partial" (only one provider, not all failed).
  assert.equal(result.providers[0]?.state, "retained");
  assert.equal(result.providers[0]?.retainedPreviousCache, true);
  assert.equal(result.state, "partial");
});

test("forwards emptyBody, redirected, and networkErrorType exactly as the provider supplied them", async () => {
  const emptyBodyResult = await runCityAlertsRefresh({
    now: fixedNow,
    providers: [
      {
        id: "vikpg",
        refresh: async () => ({
          exitCode: 1,
          summary: {
            alertCount: 1,
            diagnostics: { emptyBody: true, httpStatus: 200, redirected: false },
            errorCode: "vikpg-empty-response",
            retainedPreviousSnapshot: true,
            status: "retained",
          },
        }),
      },
    ],
  });
  assert.deepEqual(emptyBodyResult.providers[0]?.diagnostics, {
    emptyBody: true,
    httpStatus: 200,
    redirected: false,
  });

  const networkErrorResult = await runCityAlertsRefresh({
    now: fixedNow,
    providers: [
      {
        id: "vikpg",
        refresh: async () => ({
          exitCode: 1,
          summary: {
            alertCount: 0,
            diagnostics: { networkErrorType: "dns" },
            errorCode: "vikpg-network-error",
            retainedPreviousSnapshot: false,
            status: "unavailable",
          },
        }),
      },
    ],
  });
  assert.deepEqual(networkErrorResult.providers[0]?.diagnostics, { networkErrorType: "dns" });
  assert.equal(networkErrorResult.providers[0]?.state, "failed");
});

test("omits diagnostics entirely for a successful VIKPG refresh and for CEDIS, which never supplies it", async () => {
  const result = await runCityAlertsRefresh({
    now: fixedNow,
    providers: [
      {
        id: "cedis",
        refresh: async () => ({
          exitCode: 0,
          summary: { alertCount: 3, retainedPreviousSnapshot: false, status: "success" },
        }),
      },
      {
        id: "vikpg",
        refresh: async () => ({
          exitCode: 0,
          summary: { alertCount: 1, retainedPreviousSnapshot: false, status: "success" },
        }),
      },
    ],
  });

  assert.equal("diagnostics" in result.providers[0], false);
  assert.equal("diagnostics" in result.providers[1], false);
  // CEDIS's own result shape is byte-for-byte what it was before this change.
  assert.deepEqual(result.providers[0], {
    alertCount: 3,
    attempted: true,
    cacheStatus: "fresh",
    provider: "cedis",
    retainedPreviousCache: false,
    state: "success",
    success: true,
    warnings: [],
  });
});

test("never carries a body larger than the provider's own preview, headers, cookies, or a query string in the aggregate JSON", async () => {
  const result = await runCityAlertsRefresh({
    now: fixedNow,
    providers: [
      {
        id: "vikpg",
        refresh: async () => ({
          exitCode: 1,
          summary: {
            alertCount: 1,
            diagnostics: {
              finalUrl: "https://vikpg.me/mediji/servisne-informacije/obavjestenja.html",
              httpStatus: 500,
              responseBodyPreview: "Internal error while rendering the page",
            },
            errorCode: "vikpg-http-error",
            retainedPreviousSnapshot: true,
            status: "retained",
          },
        }),
      },
    ],
  });

  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes("?"), false);
  assert.equal(serialized.toLowerCase().includes("cookie"), false);
  assert.equal(serialized.toLowerCase().includes("authorization"), false);
  assert.equal(serialized.toLowerCase().includes("set-cookie"), false);
});

test("preserves successful empty refresh metadata without treating it as unavailable", async () => {
  const result = await runCityAlertsRefresh({
    now: fixedNow,
    providers: [
      {
        id: "cedis",
        refresh: async () => ({
          exitCode: 0,
          summary: {
            alertCount: 0,
            cacheStatus: "fresh",
            retainedPreviousSnapshot: false,
            status: "success",
            warnings: [],
          },
        }),
      },
    ],
  });

  assert.equal(result.state, "success");
  assert.equal(result.providers[0]?.success, true);
  assert.equal(result.providers[0]?.cacheStatus, "fresh");
});
