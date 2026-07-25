import assert from "node:assert/strict";
import { access, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  assertPodgoricaFlightsUrl,
  createPodgoricaFlightsHttpClient,
  emitPodgoricaFlightsDiagnostic,
  getCachedPodgoricaFlights,
  parsePodgoricaFlights,
  PodgoricaFlightsFetchError,
  refreshPodgoricaFlights,
  type PodgoricaFlightsHttpClient,
} from "./podgorica-flights.ts";

const fixture = new URL("./__fixtures__/podgorica-airport-flight-feed.json", import.meta.url);

test("parses the official Podgorica Airport public flight-feed format", async () => {
  const parsed = parsePodgoricaFlights(await readFile(fixture, "utf8"));

  assert.equal(parsed.recognized, true);
  assert.equal(parsed.rejected, 0);
  assert.deepEqual(
    parsed.flights.map(
      ({ direction, flightNumber, location, scheduledAt, scheduledTime, status }) => [
        direction,
        location,
        scheduledTime,
        flightNumber,
        status,
        scheduledAt,
      ],
    ),
    [
      ["arrival", "Beograd", "09:40", "JU 660", "Arrived", "2026-07-22T07:40:00.000Z"],
      ["departure", "Beograd", "10:25", "JU 661", "On Time", "2026-07-22T08:25:00.000Z"],
      ["arrival", "Istanbul", "11:40", "TK 1085", "Expected", "2026-07-22T09:40:00.000Z"],
      ["departure", "Beč", "13:05", "OS 738", "Gate Open", "2026-07-22T11:05:00.000Z"],
    ],
  );
});

test("tolerates extra provider fields and rejects only incomplete flight records", () => {
  const parsed = parsePodgoricaFlights(
    JSON.stringify({
      value: [
        {
          Airport: "Rim",
          FlightNumberIATA: "AZ 123",
          FlightType: "Departure",
          Gate: "4",
          ScheduledDateTime: "2026-07-22 14:15:00",
          StatusID: "Expected",
        },
        {
          Airport: "",
          FlightType: "Arrival",
          ScheduledDateTime: "2026-07-22T15:20:00",
        },
      ],
    }),
  );

  assert.equal(parsed.recognized, true);
  assert.equal(parsed.rejected, 1);
  assert.deepEqual(parsed.warnings, ["podgorica-flights-record-location-missing"]);
  assert.equal(parsed.flights[0]?.location, "Rim");
});

test("reports clear reasons for malformed and structurally invalid flight feeds", () => {
  const invalidJson = parsePodgoricaFlights("<html>One moment, please...</html>");
  const missingValue = parsePodgoricaFlights(JSON.stringify({ flights: [] }));
  const noValidRecords = parsePodgoricaFlights(
    JSON.stringify({ value: [{ Airport: "Beograd", FlightType: "Unknown" }] }),
  );

  assert.deepEqual(invalidJson.warnings, ["podgorica-flights-json-invalid"]);
  assert.deepEqual(missingValue.warnings, ["podgorica-flights-json-value-missing"]);
  assert.deepEqual(noValidRecords.warnings, [
    "podgorica-flights-record-direction-missing",
    "podgorica-flights-no-valid-records",
  ]);
  assert.equal(noValidRecords.recognized, false);
});

test("keeps an earlier valid snapshot when the flight feed is invalid", async () => {
  const cachePath = join(await mkdtemp(join(tmpdir(), "podgorica-flights-")), "flights.json");
  await writeFile(
    cachePath,
    JSON.stringify({
      fetchedAt: "2026-07-21T08:00:00.000Z",
      flights: [
        {
          direction: "departure",
          location: "Beograd",
          scheduledAt: "2026-07-21T08:25:00.000Z",
          scheduledDate: "2026-07-21",
          scheduledTime: "10:25",
        },
      ],
      lastSuccessfulRefreshAt: "2026-07-21T08:00:00.000Z",
      parserWarnings: [],
      schemaVersion: 1,
      sourceUrl: "https://montenegroairports.com/aerodromixs/cache-flights.php?airport=pg",
    }),
  );

  const result = await refreshPodgoricaFlights({
    cachePath,
    httpClient: responseClient(JSON.stringify({ value: [{ Airport: "Beograd" }] })),
    now: () => new Date("2026-07-21T08:00:00.000Z"),
  });

  assert.equal(result.success, false);
  assert.equal(result.retainedPreviousSnapshot, true);
  assert.equal(result.snapshot?.flights[0]?.location, "Beograd");
  assert.deepEqual(result.warnings, [
    "podgorica-flights-record-direction-missing",
    "podgorica-flights-no-valid-records",
  ]);
});

test("uses the same atomically written cache for homepage and all-flights reads", async () => {
  const cachePath = join(
    await mkdtemp(join(tmpdir(), "podgorica-flights-")),
    "nested",
    "flights.json",
  );
  const result = await refreshPodgoricaFlights({
    cachePath,
    httpClient: responseClient(await readFile(fixture, "utf8")),
    now: () => new Date("2026-07-22T08:00:00.000Z"),
  });
  const cached = await getCachedPodgoricaFlights(cachePath, new Date("2026-07-22T08:00:00.000Z"));

  assert.equal(result.success, true);
  assert.equal(cached.flights.length, 4);
  assert.equal(cached.state, "fresh");
  assert.equal(cached.lastSuccessfulRefreshAt, "2026-07-22T08:00:00.000Z");
});

test("preserves an explicitly configured absolute cache path", async () => {
  const cachePath = join(
    await mkdtemp(join(tmpdir(), "podgorica-flights-")),
    "data",
    "events",
    "podgorica-flights.json",
  );

  const result = await refreshPodgoricaFlights({
    cachePath,
    httpClient: responseClient(await readFile(fixture, "utf8")),
    now: () => new Date("2026-07-22T08:00:00.000Z"),
  });

  await access(cachePath);
  assert.equal(result.success, true);
  assert.equal(result.snapshot?.flights.length, 4);
});

test("surfaces a cache persistence failure and retains the earlier snapshot", async () => {
  const cachePath = join(await mkdtemp(join(tmpdir(), "podgorica-flights-")), "flights.json");
  await writeFile(
    cachePath,
    JSON.stringify({
      fetchedAt: "2026-07-21T08:00:00.000Z",
      flights: [],
      lastSuccessfulRefreshAt: "2026-07-21T08:00:00.000Z",
      parserWarnings: [],
      schemaVersion: 1,
      sourceUrl: "https://montenegroairports.com/aerodromixs/cache-flights.php?airport=pg",
    }),
  );

  const result = await refreshPodgoricaFlights({
    cachePath,
    cacheWriter: async () => {
      throw new Error("mounted volume is unavailable");
    },
    httpClient: responseClient(await readFile(fixture, "utf8")),
    now: () => new Date("2026-07-22T08:00:00.000Z"),
  });

  assert.equal(result.success, false);
  assert.equal(result.errorCode, "podgorica-flights-cache-write-failed");
  assert.equal(result.retainedPreviousSnapshot, true);
  assert.equal(result.snapshot?.lastRefreshError, "podgorica-flights-cache-write-failed");
});

test("accepts only the official public flight-feed endpoint and JSON-like responses", async () => {
  assert.doesNotThrow(() =>
    assertPodgoricaFlightsUrl(
      "https://montenegroairports.com/aerodromixs/cache-flights.php?airport=pg",
    ),
  );
  assert.throws(() => assertPodgoricaFlightsUrl("https://montenegroairports.com/wp-json/"));
  assert.throws(() =>
    assertPodgoricaFlightsUrl("https://example.test/aerodromixs/cache-flights.php?airport=pg"),
  );

  const client = createPodgoricaFlightsHttpClient({
    fetchImplementation: async () => ({
      headers: { get: () => "application/pdf" },
      ok: true,
      status: 200,
      text: async () => "{}",
      url: "https://montenegroairports.com/aerodromixs/cache-flights.php?airport=pg",
    }),
  });
  await assert.rejects(() =>
    client.get("https://montenegroairports.com/aerodromixs/cache-flights.php?airport=pg"),
  );
});

test("uses the bounded public GET request contract and accepts an approved redirect", async () => {
  let request: RequestInit | undefined;
  const client = createPodgoricaFlightsHttpClient({
    fetchImplementation: async (_url, init) => {
      request = init;
      return {
        headers: { get: () => "application/json" },
        ok: true,
        status: 200,
        text: async () => readFile(fixture, "utf8"),
        url: "https://www.montenegroairports.com/aerodromixs/cache-flights.php?airport=pg",
      };
    },
  });

  const response = await client.get(
    "https://montenegroairports.com/aerodromixs/cache-flights.php?airport=pg",
  );

  assert.equal(request?.method, "GET");
  assert.equal(request?.redirect, "follow");
  assert.equal(
    (request?.headers as Record<string, string>).Accept,
    "application/json, text/plain;q=0.9, text/html;q=0.5",
  );
  assert.equal(
    (request?.headers as Record<string, string>)["User-Agent"],
    "Gradom/0.1 (+https://gradom.me)",
  );
  assert.equal(
    response.finalUrl,
    "https://www.montenegroairports.com/aerodromixs/cache-flights.php?airport=pg",
  );
});

test("classifies HTTP status, timeout, and redirect failures without exposing request contents", async () => {
  const statusClient = createPodgoricaFlightsHttpClient({
    fetchImplementation: async () => ({
      headers: { get: () => "text/html" },
      ok: false,
      status: 503,
      text: async () => "unavailable",
      url: "https://montenegroairports.com/aerodromixs/cache-flights.php?airport=pg",
    }),
    retries: 0,
  });
  const timeoutClient = createPodgoricaFlightsHttpClient({
    fetchImplementation: async () => {
      const error = new Error("request timed out");
      error.name = "TimeoutError";
      throw error;
    },
    retries: 0,
  });
  const redirectClient = createPodgoricaFlightsHttpClient({
    fetchImplementation: async () => ({
      headers: { get: () => "application/json" },
      ok: true,
      status: 200,
      text: async () => "{}",
      url: "https://example.test/flight-feed",
    }),
    retries: 0,
  });

  await assert.rejects(
    () =>
      statusClient.get("https://montenegroairports.com/aerodromixs/cache-flights.php?airport=pg"),
    (error: unknown) => {
      assert.ok(error instanceof PodgoricaFlightsFetchError);
      assert.equal(error.failureCategory, "http-status");
      assert.equal(error.httpStatus, 503);
      return true;
    },
  );
  await assert.rejects(
    () =>
      timeoutClient.get("https://montenegroairports.com/aerodromixs/cache-flights.php?airport=pg"),
    (error: unknown) => {
      assert.ok(error instanceof PodgoricaFlightsFetchError);
      assert.equal(error.code, "podgorica-flights-timeout");
      assert.equal(error.failureCategory, "timeout");
      return true;
    },
  );
  await assert.rejects(
    () =>
      redirectClient.get("https://montenegroairports.com/aerodromixs/cache-flights.php?airport=pg"),
    (error: unknown) => {
      assert.ok(error instanceof PodgoricaFlightsFetchError);
      assert.equal(error.failureCategory, "redirect");
      assert.equal(error.finalHostname, "example.test");
      return true;
    },
  );
});

test("retains a valid snapshot and emits safe diagnostics after a DNS request failure", async () => {
  const cachePath = join(await mkdtemp(join(tmpdir(), "podgorica-flights-")), "flights.json");
  const diagnostics: Record<string, unknown>[] = [];
  await writeFile(
    cachePath,
    JSON.stringify({
      fetchedAt: "2026-07-21T08:00:00.000Z",
      flights: [],
      lastSuccessfulRefreshAt: "2026-07-21T08:00:00.000Z",
      parserWarnings: [],
      schemaVersion: 1,
      sourceUrl: "https://montenegroairports.com/aerodromixs/cache-flights.php?airport=pg",
    }),
  );
  const client = createPodgoricaFlightsHttpClient({
    fetchImplementation: async () => {
      const error = Object.assign(new Error("fetch failed"), { code: "ENOTFOUND" });
      throw error;
    },
    retries: 0,
  });

  const result = await refreshPodgoricaFlights({
    cachePath,
    diagnostic: (payload) => diagnostics.push(payload),
    httpClient: client,
  });

  assert.equal(result.success, false);
  assert.equal(result.errorCode, "podgorica-flights-request-failed");
  assert.equal(result.retainedPreviousSnapshot, true);
  assert.deepEqual(diagnostics, [
    {
      elapsedMs: diagnostics[0]?.elapsedMs,
      errorCode: "podgorica-flights-request-failed",
      event: "podgorica-flights-request-failed",
      failureCategory: "dns",
      provider: "podgorica-airport",
      upstreamHostname: "montenegroairports.com",
    },
  ]);
  assert.equal("body" in (diagnostics[0] ?? {}), false);
  assert.equal("headers" in (diagnostics[0] ?? {}), false);
});

test("emits one parseable metadata-only request failure diagnostic", () => {
  const messages: string[] = [];
  const originalError = console.error;
  console.error = (message: string) => messages.push(message);
  try {
    emitPodgoricaFlightsDiagnostic({
      elapsedMs: 125,
      errorCode: "podgorica-flights-request-failed",
      event: "podgorica-flights-request-failed",
      failureCategory: "dns",
      provider: "podgorica-airport",
      upstreamHostname: "montenegroairports.com",
    });
  } finally {
    console.error = originalError;
  }

  assert.equal(messages.length, 1);
  assert.deepEqual(JSON.parse(messages[0] ?? "{}"), {
    elapsedMs: 125,
    errorCode: "podgorica-flights-request-failed",
    event: "podgorica-flights-request-failed",
    failureCategory: "dns",
    provider: "podgorica-airport",
    upstreamHostname: "montenegroairports.com",
  });
});

function responseClient(body: string): PodgoricaFlightsHttpClient {
  return {
    get: async (requestedUrl) => ({
      body,
      contentType: "application/json; charset=utf-8",
      finalUrl: requestedUrl,
      requestedUrl,
      status: 200,
    }),
  };
}
