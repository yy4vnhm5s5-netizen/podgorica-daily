import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { selectUpcomingRailwayDepartures } from "../domain/railway-departure.ts";
import { createZpcgHttpClient, parseZpcgPodgoricaDepartures, refreshZpcgRailway } from "./zpcg-railway.ts";

const fixture = new URL("./__fixtures__/zpcg-timetable.html", import.meta.url);

test("selects, sorts, and deduplicates only Podgorica departures", async () => {
  const parsed = parseZpcgPodgoricaDepartures(await readFile(fixture, "utf8"), "2026-07-20");
  assert.equal(parsed.sectionFound, true);
  assert.equal(parsed.contentRecognized, true);
  assert.deepEqual(
    parsed.departures.map(({ departureTime, destination, trainNumber }) => [
      departureTime,
      destination,
      trainNumber,
    ]),
    [
      ["07:55", "Bar", "6153"],
      ["08:00", "Danilovgrad", "7100"],
      ["12:55", "Bar", "6155"],
    ],
  );
  assert.equal(parsed.departures.at(-1)?.detailsUrl, "https://zpcg.me/red-voznje/detalji/6155");
  assert.deepEqual(parsed.departures.at(-1), {
    arrivalTime: "13:55",
    departureDate: "2026-07-20",
    departureStation: "Podgorica",
    departureTime: "12:55",
    destination: "Bar",
    detailsUrl: "https://zpcg.me/red-voznje/detalji/6155",
    duration: "1h 0m",
    firstClassPrice: "4.20€",
    secondClassPrice: "2.80€",
    trainNumber: "6155",
  });
  assert.deepEqual(
    selectUpcomingRailwayDepartures(parsed.departures, new Date("2026-07-20T06:30:00.000Z")).map(
      ({ departureTime }) => departureTime,
    ),
    ["12:55"],
  );
});

test("retains a valid cache when the official source fails", async () => {
  const previous = { departures: [], fetchedAt: "2026-07-20T08:00:00.000Z", freshnessStatus: "fresh" as const, lastSuccessfulRefreshAt: "2026-07-20T08:00:00.000Z", parserWarnings: [], schemaVersion: 1 as const, sourceUrl: "https://zpcg.me/red-voznje/ukupno", timetableDate: "2026-07-20" };
  const cachePath = join(await mkdtemp(join(tmpdir(), "zpcg-test-")), "railway.json");
  await writeFile(cachePath, JSON.stringify(previous), "utf8");
  const result = await refreshZpcgRailway({ cachePath, httpClient: { get: async () => { throw new Error("offline"); } } });
  assert.equal(result.success, false);
  assert.equal(result.retainedPreviousSnapshot, true);
  assert.equal(result.snapshot?.timetableDate, "2026-07-20");
});

test("does not confuse other-station departures with Podgorica departures", () => {
  const parsed = parseZpcgPodgoricaDepartures(
    "<h2>Polasci iz stanice Bar</h2><p>Polazak 08:00 Voz: 6150 Bar Podgorica Dolazak 09:00 1. razred 4.20€ 2. razred 2.80€</p>",
    "2026-07-20",
  );

  assert.equal(parsed.sectionFound, false);
  assert.equal(parsed.departures.length, 0);
});

test("preserves a valid empty timetable state only when the source says it is empty", () => {
  const parsed = parseZpcgPodgoricaDepartures(
    '<input name="date" value="2026-07-20"><h2>Polasci iz stanice Podgorica</h2><p>Nema polazaka za odabrani datum.</p>',
    "2026-07-19",
  );

  assert.equal(parsed.contentRecognized, true);
  assert.deepEqual(parsed.departures, []);
  assert.equal(parsed.timetableDate, "2026-07-20");
});

test("does not replace a valid cache when the Podgorica section changes shape", async () => {
  const previous = {
    departures: [
      {
        departureDate: "2026-07-20",
        departureStation: "Podgorica" as const,
        departureTime: "12:55",
        destination: "Bar",
      },
    ],
    fetchedAt: "2026-07-20T08:00:00.000Z",
    freshnessStatus: "fresh" as const,
    lastSuccessfulRefreshAt: "2026-07-20T08:00:00.000Z",
    parserWarnings: [],
    schemaVersion: 1 as const,
    sourceUrl: "https://zpcg.me/red-voznje/ukupno",
    timetableDate: "2026-07-20",
  };
  const cachePath = join(await mkdtemp(join(tmpdir(), "zpcg-test-")), "railway.json");
  await writeFile(cachePath, JSON.stringify(previous), "utf8");

  const result = await refreshZpcgRailway({
    cachePath,
    httpClient: {
      get: async () =>
        '<input name="date" value="2026-07-20"><h2>Polasci iz stanice Podgorica</h2><p>Novi prikaz rasporeda.</p>',
    },
  });

  assert.equal(result.success, false);
  assert.equal(result.errorCode, "zpcg-records-unrecognized");
  assert.deepEqual(result.snapshot?.departures, previous.departures);
});

test("rejects non-official timetable hosts", async () => {
  const client = createZpcgHttpClient({ fetchImplementation: async () => { throw new Error("must not fetch"); } });
  await assert.rejects(() => client.get("https://example.test/timetable"));
});
