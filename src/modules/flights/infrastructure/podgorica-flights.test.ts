import assert from "node:assert/strict";
import { access, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  assertPodgoricaFlightsUrl,
  createPodgoricaFlightsHttpClient,
  createPodgoricaFlightsUrl,
  defaultPodgoricaFlightsCachePath,
  emitPodgoricaFlightsDiagnostic,
  getCachedPodgoricaFlights,
  getFlightsCachePath,
  isFlightsSupportedCityId,
  isPodgoricaFlightsUpstreamErrorCode,
  parsePodgoricaFlights,
  PodgoricaFlightsFetchError,
  refreshPodgoricaFlights,
  type FlightsSupportedCityId,
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
    diagnostic: () => {},
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

test("retains a non-empty previous snapshot when the response is structurally valid but reports zero flights", async () => {
  const cachePath = join(await mkdtemp(join(tmpdir(), "podgorica-flights-")), "flights.json");
  const flights = parsePodgoricaFlights(await readFile(fixture, "utf8")).flights;
  await writeFile(
    cachePath,
    JSON.stringify({
      fetchedAt: "2026-07-22T08:00:00.000Z",
      flights,
      lastSuccessfulRefreshAt: "2026-07-22T08:00:00.000Z",
      parserWarnings: [],
      schemaVersion: 1,
      sourceUrl: "https://montenegroairports.com/aerodromixs/cache-flights.php?airport=pg",
    }),
  );

  const result = await refreshPodgoricaFlights({
    cachePath,
    diagnostic: () => {},
    httpClient: responseClient('{"value":[]}'),
    now: () => new Date("2026-07-22T08:30:00.000Z"),
  });
  const cached = await getCachedPodgoricaFlights(cachePath, new Date("2026-07-22T08:30:00.000Z"));

  assert.equal(result.success, false);
  assert.equal(result.retainedPreviousSnapshot, true);
  assert.equal(result.errorCode, "podgorica-flights-empty-response");
  assert.equal(result.acceptedFlights, flights.length);
  assert.equal(result.snapshot?.flights.length, flights.length);
  assert.equal(cached.flights.length, flights.length);
});

test("writes an empty response through when there is no previous snapshot to protect", async () => {
  const cachePath = join(await mkdtemp(join(tmpdir(), "podgorica-flights-")), "flights.json");

  const result = await refreshPodgoricaFlights({
    cachePath,
    diagnostic: () => {},
    httpClient: responseClient('{"value":[]}'),
    now: () => new Date("2026-07-22T08:00:00.000Z"),
  });

  assert.equal(result.success, true);
  assert.equal(result.retainedPreviousSnapshot, false);
  assert.equal(result.acceptedFlights, 0);
  assert.deepEqual(result.snapshot?.flights, []);
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

test("retries a transient HTTP 500 once and writes a snapshot after the successful retry", async () => {
  const cachePath = join(await mkdtemp(join(tmpdir(), "podgorica-flights-")), "flights.json");
  let attempts = 0;
  const client = createPodgoricaFlightsHttpClient({
    fetchImplementation: async () => {
      attempts += 1;
      if (attempts === 1) {
        return {
          headers: { get: () => "text/html" },
          ok: false,
          status: 500,
          text: async () => "upstream error",
          url: "https://montenegroairports.com/aerodromixs/cache-flights.php?airport=pg",
        };
      }

      return {
        headers: { get: () => "application/json" },
        ok: true,
        status: 200,
        text: async () => readFile(fixture, "utf8"),
        url: "https://montenegroairports.com/aerodromixs/cache-flights.php?airport=pg",
      };
    },
    sleep: async () => {},
  });

  const result = await refreshPodgoricaFlights({
    cachePath,
    httpClient: client,
    now: () => new Date("2026-07-22T08:00:00.000Z"),
  });
  const cached = await getCachedPodgoricaFlights(cachePath, new Date("2026-07-22T08:00:00.000Z"));

  assert.equal(attempts, 2);
  assert.equal(result.success, true);
  assert.equal(result.acceptedFlights, 4);
  assert.equal(cached.flights.length, 4);
});

test("retries every supported transient upstream HTTP status once", async () => {
  for (const status of [502, 503, 504]) {
    let attempts = 0;
    const client = createPodgoricaFlightsHttpClient({
      fetchImplementation: async () => {
        attempts += 1;
        return attempts === 1
          ? {
              headers: { get: () => "text/html" },
              ok: false,
              status,
              text: async () => "upstream error",
              url: "https://montenegroairports.com/aerodromixs/cache-flights.php?airport=pg",
            }
          : {
              headers: { get: () => "application/json" },
              ok: true,
              status: 200,
              text: async () => '{"value":[]}',
              url: "https://montenegroairports.com/aerodromixs/cache-flights.php?airport=pg",
            };
      },
      sleep: async () => {},
    });

    await client.get("https://montenegroairports.com/aerodromixs/cache-flights.php?airport=pg");
    assert.equal(attempts, 2);
  }
});

test("keeps the existing unavailable or retained result after two HTTP 500 responses", async () => {
  const cacheDirectory = await mkdtemp(join(tmpdir(), "podgorica-flights-"));
  const unavailableCachePath = join(cacheDirectory, "unavailable.json");
  const retainedCachePath = join(cacheDirectory, "retained.json");
  const flights = parsePodgoricaFlights(await readFile(fixture, "utf8")).flights;
  await writeFile(
    retainedCachePath,
    JSON.stringify({
      fetchedAt: "2026-07-22T08:00:00.000Z",
      flights,
      lastSuccessfulRefreshAt: "2026-07-22T08:00:00.000Z",
      parserWarnings: [],
      schemaVersion: 1,
      sourceUrl: "https://montenegroairports.com/aerodromixs/cache-flights.php?airport=pg",
    }),
  );

  let attempts = 0;
  const client = createPodgoricaFlightsHttpClient({
    fetchImplementation: async () => {
      attempts += 1;
      return {
        headers: { get: () => "text/html" },
        ok: false,
        status: 500,
        text: async () => "upstream error",
        url: "https://montenegroairports.com/aerodromixs/cache-flights.php?airport=pg",
      };
    },
    sleep: async () => {},
  });

  const unavailable = await refreshPodgoricaFlights({
    cachePath: unavailableCachePath,
    diagnostic: () => {},
    httpClient: client,
  });
  const retained = await refreshPodgoricaFlights({
    cachePath: retainedCachePath,
    diagnostic: () => {},
    httpClient: client,
  });

  // Each refreshPodgoricaFlights call exhausts the client's full retry budget (5 attempts:
  // the initial try plus 4 retries) before giving up, since every response is a 500.
  assert.equal(attempts, 10);
  assert.equal(unavailable.success, false);
  assert.equal(unavailable.retainedPreviousSnapshot, false);
  assert.equal(unavailable.snapshot, null);
  assert.equal(retained.success, false);
  assert.equal(retained.retainedPreviousSnapshot, true);
  assert.equal(retained.snapshot?.flights.length, flights.length);
});

test("recovers from four transient failures and writes a snapshot on the fifth attempt", async () => {
  const cachePath = join(await mkdtemp(join(tmpdir(), "podgorica-flights-")), "flights.json");
  let attempts = 0;
  const delays: number[] = [];
  const client = createPodgoricaFlightsHttpClient({
    fetchImplementation: async () => {
      attempts += 1;
      if (attempts <= 4) {
        return {
          headers: { get: () => "text/html" },
          ok: false,
          status: 500,
          text: async () => "upstream error",
          url: "https://montenegroairports.com/aerodromixs/cache-flights.php?airport=pg",
        };
      }

      return {
        headers: { get: () => "application/json" },
        ok: true,
        status: 200,
        text: async () => readFile(fixture, "utf8"),
        url: "https://montenegroairports.com/aerodromixs/cache-flights.php?airport=pg",
      };
    },
    sleep: async (delayMs) => {
      delays.push(delayMs);
    },
  });

  const result = await refreshPodgoricaFlights({
    cachePath,
    httpClient: client,
    now: () => new Date("2026-07-22T08:00:00.000Z"),
  });
  const cached = await getCachedPodgoricaFlights(cachePath, new Date("2026-07-22T08:00:00.000Z"));

  assert.equal(attempts, 5);
  assert.deepEqual(delays, [500, 1000, 2000, 4000]);
  assert.equal(result.success, true);
  assert.equal(result.acceptedFlights, 4);
  assert.equal(cached.flights.length, 4);
});

test("returns an unavailable result with no cache once every retry attempt fails", async () => {
  const cachePath = join(await mkdtemp(join(tmpdir(), "podgorica-flights-")), "flights.json");
  let attempts = 0;
  const client = createPodgoricaFlightsHttpClient({
    fetchImplementation: async () => {
      attempts += 1;
      return {
        headers: { get: () => "text/html" },
        ok: false,
        status: 500,
        text: async () => "upstream error",
        url: "https://montenegroairports.com/aerodromixs/cache-flights.php?airport=pg",
      };
    },
    sleep: async () => {},
  });

  const result = await refreshPodgoricaFlights({
    cachePath,
    diagnostic: () => {},
    httpClient: client,
  });

  assert.equal(attempts, 5);
  assert.equal(result.success, false);
  assert.equal(result.retainedPreviousSnapshot, false);
  assert.equal(result.snapshot, null);
  await assert.rejects(() => access(cachePath));
});

test("retains the previous snapshot on disk once every retry attempt fails", async () => {
  const cachePath = join(await mkdtemp(join(tmpdir(), "podgorica-flights-")), "flights.json");
  const flights = parsePodgoricaFlights(await readFile(fixture, "utf8")).flights;
  const previousSnapshot = {
    fetchedAt: "2026-07-22T08:00:00.000Z",
    flights,
    lastSuccessfulRefreshAt: "2026-07-22T08:00:00.000Z",
    parserWarnings: [],
    schemaVersion: 1,
    sourceUrl: "https://montenegroairports.com/aerodromixs/cache-flights.php?airport=pg",
  };
  await writeFile(cachePath, JSON.stringify(previousSnapshot));

  let attempts = 0;
  const client = createPodgoricaFlightsHttpClient({
    fetchImplementation: async () => {
      attempts += 1;
      return {
        headers: { get: () => "text/html" },
        ok: false,
        status: 500,
        text: async () => "upstream error",
        url: "https://montenegroairports.com/aerodromixs/cache-flights.php?airport=pg",
      };
    },
    sleep: async () => {},
  });

  const result = await refreshPodgoricaFlights({
    cachePath,
    diagnostic: () => {},
    httpClient: client,
  });
  const onDisk = JSON.parse(await readFile(cachePath, "utf8"));

  assert.equal(attempts, 5);
  assert.equal(result.success, false);
  assert.equal(result.retainedPreviousSnapshot, true);
  assert.equal(result.snapshot?.flights.length, flights.length);
  assert.equal(onDisk.flights.length, flights.length);
  assert.equal(onDisk.fetchedAt, previousSnapshot.fetchedAt);
});

test("does not repeatedly retry a permanent HTTP 4xx failure", async () => {
  let attempts = 0;
  const client = createPodgoricaFlightsHttpClient({
    fetchImplementation: async () => {
      attempts += 1;
      return {
        headers: { get: () => "text/html" },
        ok: false,
        status: 404,
        text: async () => "not found",
        url: "https://montenegroairports.com/aerodromixs/cache-flights.php?airport=pg",
      };
    },
    sleep: async () => {
      throw new Error("must not sleep before a permanent 4xx failure");
    },
  });

  await assert.rejects(() =>
    client.get("https://montenegroairports.com/aerodromixs/cache-flights.php?airport=pg"),
  );

  assert.equal(attempts, 1);
});

test("an empty but well-formed response still cannot replace a previous non-empty snapshot under the retry-enabled client", async () => {
  const cachePath = join(await mkdtemp(join(tmpdir(), "podgorica-flights-")), "flights.json");
  const flights = parsePodgoricaFlights(await readFile(fixture, "utf8")).flights;
  await writeFile(
    cachePath,
    JSON.stringify({
      fetchedAt: "2026-07-22T08:00:00.000Z",
      flights,
      lastSuccessfulRefreshAt: "2026-07-22T08:00:00.000Z",
      parserWarnings: [],
      schemaVersion: 1,
      sourceUrl: "https://montenegroairports.com/aerodromixs/cache-flights.php?airport=pg",
    }),
  );

  const client = createPodgoricaFlightsHttpClient({
    fetchImplementation: async () => ({
      headers: { get: () => "application/json" },
      ok: true,
      status: 200,
      text: async () => '{"value":[]}',
      url: "https://montenegroairports.com/aerodromixs/cache-flights.php?airport=pg",
    }),
    sleep: async () => {
      throw new Error("must not sleep after a successful, if empty, response");
    },
  });

  const result = await refreshPodgoricaFlights({
    cachePath,
    diagnostic: () => {},
    httpClient: client,
  });
  const cached = await getCachedPodgoricaFlights(cachePath, new Date("2026-07-22T08:05:00.000Z"));

  assert.equal(result.success, false);
  assert.equal(result.errorCode, "podgorica-flights-empty-response");
  assert.equal(result.retainedPreviousSnapshot, true);
  assert.equal(cached.flights.length, flights.length);
});

test("bounds the retry loop to exactly the configured attempt count even under persistent failure", async () => {
  for (const configuredRetries of [0, 2, 4]) {
    let attempts = 0;
    const client = createPodgoricaFlightsHttpClient({
      fetchImplementation: async () => {
        attempts += 1;
        return {
          headers: { get: () => "text/html" },
          ok: false,
          status: 503,
          text: async () => "unavailable",
          url: "https://montenegroairports.com/aerodromixs/cache-flights.php?airport=pg",
        };
      },
      retries: configuredRetries,
      sleep: async () => {},
    });

    await assert.rejects(() =>
      client.get("https://montenegroairports.com/aerodromixs/cache-flights.php?airport=pg"),
    );

    assert.equal(attempts, configuredRetries + 1);
  }
});

test("does not retry non-retryable HTTP 4xx responses or exceed the configured retry count", async () => {
  let clientAttempts = 0;
  const client = createPodgoricaFlightsHttpClient({
    fetchImplementation: async () => {
      clientAttempts += 1;
      return {
        headers: { get: () => "text/html" },
        ok: false,
        status: 404,
        text: async () => "not found",
        url: "https://montenegroairports.com/aerodromixs/cache-flights.php?airport=pg",
      };
    },
  });

  await assert.rejects(() =>
    client.get("https://montenegroairports.com/aerodromixs/cache-flights.php?airport=pg"),
  );

  assert.equal(clientAttempts, 1);

  let configuredAttempts = 0;
  const configuredClient = createPodgoricaFlightsHttpClient({
    fetchImplementation: async () => {
      configuredAttempts += 1;
      return {
        headers: { get: () => "text/html" },
        ok: false,
        status: 503,
        text: async () => "unavailable",
        url: "https://montenegroairports.com/aerodromixs/cache-flights.php?airport=pg",
      };
    },
    retries: 2,
  });

  await assert.rejects(() =>
    configuredClient.get("https://montenegroairports.com/aerodromixs/cache-flights.php?airport=pg"),
  );

  assert.equal(configuredAttempts, 3);
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
    now: () => new Date("2026-07-21T08:05:00.000Z"),
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
      failureType: "network",
      finalState: "failed",
      provider: "podgorica-airport",
      retainedPreviousSnapshot: true,
      retainedRecordCount: 0,
      retainedSnapshotAgeMs: 300_000,
      retryCountPerformed: 0,
      totalAttemptCount: 1,
      upstreamHostname: "montenegroairports.com",
    },
  ]);
  assert.equal("body" in (diagnostics[0] ?? {}), false);
  assert.equal("headers" in (diagnostics[0] ?? {}), false);
});

test("retains cache-backed flights after an HTTP 500 without exposing the refresh error to readers", async () => {
  const cachePath = join(await mkdtemp(join(tmpdir(), "podgorica-flights-")), "flights.json");
  const diagnostics: Record<string, unknown>[] = [];
  const flights = parsePodgoricaFlights(await readFile(fixture, "utf8")).flights;
  await writeFile(
    cachePath,
    JSON.stringify({
      fetchedAt: "2026-07-22T08:00:00.000Z",
      flights,
      lastSuccessfulRefreshAt: "2026-07-22T08:00:00.000Z",
      parserWarnings: [],
      schemaVersion: 1,
      sourceUrl: "https://montenegroairports.com/aerodromixs/cache-flights.php?airport=pg",
    }),
  );
  const client = createPodgoricaFlightsHttpClient({
    fetchImplementation: async () => ({
      headers: { get: () => "text/html" },
      ok: false,
      status: 500,
      text: async () => "upstream error",
      url: "https://montenegroairports.com/aerodromixs/cache-flights.php?airport=pg",
    }),
    retries: 0,
  });

  const result = await refreshPodgoricaFlights({
    cachePath,
    diagnostic: (payload) => diagnostics.push(payload),
    httpClient: client,
    now: () => new Date("2026-07-22T08:05:00.000Z"),
  });
  const cached = await getCachedPodgoricaFlights(cachePath, new Date("2026-07-22T08:05:00.000Z"));

  assert.equal(result.success, false);
  assert.equal(result.retainedPreviousSnapshot, true);
  assert.equal(cached.flights.length, flights.length);
  assert.equal(cached.state, "fresh");
  assert.equal("lastRefreshError" in cached, false);
  assert.deepEqual(diagnostics, [
    {
      elapsedMs: diagnostics[0]?.elapsedMs,
      errorCode: "podgorica-flights-request-failed",
      event: "podgorica-flights-request-failed",
      failureCategory: "http-status",
      failureType: "http",
      finalHostname: "montenegroairports.com",
      finalState: "failed",
      httpStatus: 500,
      provider: "podgorica-airport",
      responseContentType: "text/html",
      retainedPreviousSnapshot: true,
      retainedRecordCount: flights.length,
      retainedSnapshotAgeMs: 300_000,
      retryCountPerformed: 0,
      totalAttemptCount: 1,
      upstreamHostname: "montenegroairports.com",
    },
  ]);
  assert.equal("body" in (diagnostics[0] ?? {}), false);
});

test("emits a bounded safe preview and final retry metadata for an HTTP failure", async () => {
  const cachePath = join(await mkdtemp(join(tmpdir(), "podgorica-flights-")), "flights.json");
  const diagnostics: Record<string, unknown>[] = [];
  const responseBody = `{"error":"${"x".repeat(240)}"}`;
  const client = createPodgoricaFlightsHttpClient({
    fetchImplementation: async () => ({
      body: readableBody(responseBody),
      headers: {
        get: (name) => {
          if (name === "content-type") return "application/problem+json";
          if (name === "content-length") return String(responseBody.length);
          return null;
        },
      },
      ok: false,
      status: 500,
      text: async () => responseBody,
      url: "https://montenegroairports.com/aerodromixs/cache-flights.php?airport=pg",
    }),
    retries: 1,
    sleep: async () => {},
  });

  const result = await refreshPodgoricaFlights({
    cachePath,
    diagnostic: (payload) => diagnostics.push(payload),
    httpClient: client,
  });

  assert.equal(result.success, false);
  assert.deepEqual(diagnostics, [
    {
      elapsedMs: diagnostics[0]?.elapsedMs,
      errorCode: "podgorica-flights-request-failed",
      event: "podgorica-flights-request-failed",
      failureCategory: "http-status",
      failureType: "http",
      finalHostname: "montenegroairports.com",
      finalState: "failed",
      httpStatus: 500,
      provider: "podgorica-airport",
      responseBodyPreview: responseBody.slice(0, 200),
      responseContentLength: responseBody.length,
      responseContentType: "application/problem+json",
      retainedPreviousSnapshot: false,
      retainedRecordCount: 0,
      retainedSnapshotAgeMs: null,
      retryCountPerformed: 1,
      totalAttemptCount: 2,
      upstreamHostname: "montenegroairports.com",
    },
  ]);
  assert.equal((diagnostics[0]?.responseBodyPreview as string).length, 200);
  assert.equal("responseBody" in (diagnostics[0] ?? {}), false);
});

test("identifies an HTML response that fails JSON parsing", async () => {
  const diagnostics: Record<string, unknown>[] = [];
  const result = await refreshPodgoricaFlights({
    cachePath: join(await mkdtemp(join(tmpdir(), "podgorica-flights-")), "flights.json"),
    diagnostic: (payload) => diagnostics.push(payload),
    httpClient: {
      get: async (requestedUrl) => ({
        attemptCount: 1,
        body: "<html><title>Maintenance</title></html>",
        contentType: "text/html; charset=utf-8",
        finalUrl: requestedUrl,
        requestedUrl,
        status: 200,
      }),
    },
  });

  assert.equal(result.errorCode, "podgorica-flights-parser-failed");
  assert.deepEqual(diagnostics[0], {
    errorCode: "podgorica-flights-parser-failed",
    event: "podgorica-flights-request-failed",
    failureCategory: "response-format",
    failureType: "parser",
    finalHostname: "montenegroairports.com",
    finalState: "failed",
    httpStatus: 200,
    provider: "podgorica-airport",
    responseBodyPreview: "<html><title>Maintenance</title></html>",
    responseContentLength: 39,
    responseContentType: "text/html; charset=utf-8",
    retainedPreviousSnapshot: false,
    retainedRecordCount: 0,
    retainedSnapshotAgeMs: null,
    retryCountPerformed: 0,
    totalAttemptCount: 1,
    upstreamHostname: "montenegroairports.com",
  });
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

test("supports only Podgorica until a verified Airports of Montenegro airport code is added for another city", () => {
  assert.equal(isFlightsSupportedCityId("podgorica"), true);
  assert.equal(isFlightsSupportedCityId("tivat"), false);
  assert.equal(isFlightsSupportedCityId("budva"), false);
});

test("builds the Podgorica request URL from the airport-code map, not a separate literal", () => {
  assert.equal(
    createPodgoricaFlightsUrl("podgorica"),
    "https://montenegroairports.com/aerodromixs/cache-flights.php?airport=pg",
  );
});

test("rejects a request URL whose airport code is not in the known-airport allowlist", () => {
  assert.throws(
    () =>
      assertPodgoricaFlightsUrl(
        "https://montenegroairports.com/aerodromixs/cache-flights.php?airport=tv",
      ),
    PodgoricaFlightsFetchError,
  );
  assert.throws(
    () => assertPodgoricaFlightsUrl("https://montenegroairports.com/aerodromixs/cache-flights.php"),
    PodgoricaFlightsFetchError,
  );
});

test("keeps Podgorica's cache path backward compatible with the configured env path", () => {
  assert.equal(getFlightsCachePath("podgorica"), defaultPodgoricaFlightsCachePath);
});

test("derives a sibling cache path for any non-Podgorica supported city, mirroring the CEDIS convention", () => {
  // "tivat" is not a real member of FlightsSupportedCityId yet (its airport code is unverified —
  // see the comment above montenegroAirportsCodes in podgorica-flights.ts), but the derivation
  // function's logic is generic and worth verifying directly ahead of that city being added.
  const derivedPath = getFlightsCachePath("tivat" as FlightsSupportedCityId);
  const podgoricaPath = getFlightsCachePath("podgorica");

  assert.notEqual(derivedPath, podgoricaPath);
  assert.match(derivedPath, /podgorica-flights-tivat\.json$/u);
});

test("classifies every known upstream Flights error code as upstream, and everything else as not", () => {
  for (const errorCode of [
    "podgorica-flights-empty-response",
    "podgorica-flights-host-rejected",
    "podgorica-flights-invalid-content-type",
    "podgorica-flights-parser-failed",
    "podgorica-flights-request-failed",
    "podgorica-flights-response-too-large",
    "podgorica-flights-timeout",
  ]) {
    assert.equal(isPodgoricaFlightsUpstreamErrorCode(errorCode), true, errorCode);
  }

  for (const errorCode of [
    "podgorica-flights-cache-write-failed",
    "podgorica-flights-refresh-failed",
    "some-unrelated-or-future-error-code",
  ]) {
    assert.equal(isPodgoricaFlightsUpstreamErrorCode(errorCode), false, errorCode);
  }
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

function readableBody(value: string) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(value));
      controller.close();
    },
  });
}
