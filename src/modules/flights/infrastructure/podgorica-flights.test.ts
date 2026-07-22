import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  createPodgoricaFlightsHttpClient,
  getCachedPodgoricaFlights,
  parsePodgoricaFlights,
  refreshPodgoricaFlights,
  type PodgoricaFlightsHttpClient,
} from "./podgorica-flights.ts";

const fixture = new URL("./__fixtures__/podgorica-airport-flights.html", import.meta.url);

test("parses official-style Podgorica arrivals and departures with optional airline data", async () => {
  const parsed = parsePodgoricaFlights(await readFile(fixture, "utf8"), "2026-07-21");

  assert.equal(parsed.recognized, true);
  assert.equal(parsed.rejected, 0);
  assert.deepEqual(
    parsed.flights.map((flight) => [
      flight.direction,
      flight.location,
      flight.scheduledTime,
      flight.airline,
    ]),
    [
      ["departure", "Beograd", "10:25", "Air Serbia"],
      ["arrival", "Istanbul", "11:40", "Turkish Airlines"],
      ["departure", "Beč", "13:05", "Ryanair"],
      ["arrival", "Milano", "14:15", undefined],
    ],
  );
  assert.equal(parsed.flights[3]?.flightNumber, "W4 6789");
  assert.equal(parsed.flights[3]?.status, "Scheduled");
});

test("keeps an earlier valid snapshot when the official table shape is unavailable", async () => {
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
      sourceUrl: "https://montenegroairports.com/aerodrom-podgorica/destinacije/",
    }),
  );

  const result = await refreshPodgoricaFlights({
    cachePath,
    httpClient: responseClient("<html><h1>Maintenance</h1></html>"),
    now: () => new Date("2026-07-21T08:00:00.000Z"),
  });

  assert.equal(result.success, false);
  assert.equal(result.retainedPreviousSnapshot, true);
  assert.equal(result.snapshot?.flights[0]?.location, "Beograd");
});

test("uses the same atomically written cache for homepage and all-flights reads", async () => {
  const cachePath = join(
    await mkdtemp(join(tmpdir(), "podgorica-flights-")),
    "nested",
    "flights.json",
  );
  const html = await readFile(fixture, "utf8");
  const result = await refreshPodgoricaFlights({
    cachePath,
    httpClient: responseClient(html),
    now: () => new Date("2026-07-21T08:00:00.000Z"),
  });
  const cached = await getCachedPodgoricaFlights(cachePath, new Date("2026-07-21T08:00:00.000Z"));

  assert.equal(result.success, true);
  assert.equal(cached.flights.length, 8);
  assert.equal(cached.state, "fresh");
  assert.equal(cached.lastSuccessfulRefreshAt, "2026-07-21T08:00:00.000Z");
});

test("rejects non-official hosts and non-HTML responses", async () => {
  const client = createPodgoricaFlightsHttpClient({
    fetchImplementation: async () => {
      throw new Error("must not fetch");
    },
  });
  await assert.rejects(() => client.get("https://example.test/flights"));

  const jsonClient = createPodgoricaFlightsHttpClient({
    fetchImplementation: async () => ({
      headers: { get: () => "application/json" },
      ok: true,
      status: 200,
      text: async () => "{}",
      url: "https://montenegroairports.com/aerodrom-podgorica/destinacije/",
    }),
  });
  await assert.rejects(() =>
    jsonClient.get("https://montenegroairports.com/aerodrom-podgorica/destinacije/"),
  );
});

function responseClient(html: string): PodgoricaFlightsHttpClient {
  return {
    get: async (requestedUrl) => ({
      contentType: "text/html; charset=utf-8",
      finalUrl: requestedUrl,
      html,
      requestedUrl,
      status: 200,
    }),
  };
}
