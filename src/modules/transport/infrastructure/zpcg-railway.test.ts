import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { selectUpcomingRailwayDepartures } from "../domain/railway-departure.ts";
import {
  createZpcgHttpClient,
  getCachedZpcgRailway,
  parseZpcgPodgoricaDepartures,
  refreshZpcgRailway,
  zpcgTimetableUrl,
  type ZpcgHttpClient,
  type ZpcgRefreshDiagnostic,
} from "./zpcg-railway.ts";

const fixture = new URL("./__fixtures__/zpcg-current-timetable.html", import.meta.url);

test("parses the current official-style timetable structure and only Podgorica departures", async () => {
  const parsed = parseZpcgPodgoricaDepartures(await readFile(fixture, "utf8"), "2026-07-20");

  assert.equal(parsed.sectionFound, true);
  assert.equal(parsed.contentRecognized, true);
  assert.equal(parsed.rawRowsDetected, 2);
  assert.equal(parsed.acceptedDepartures, 2);
  assert.equal(parsed.rejectedDepartures, 0);
  assert.equal(parsed.timetableDate, "2026-07-20");
  assert.deepEqual(
    parsed.departures.map(({ departureTime, destination, trainNumber }) => [
      departureTime,
      destination,
      trainNumber,
    ]),
    [
      ["05:12", "Bar", "6151"],
      ["08:00", "Danilovgrad", "7100"],
    ],
  );
  assert.deepEqual(parsed.departures[0], {
    arrivalTime: "06:11",
    departureDate: "2026-07-20",
    departureStation: "Podgorica",
    departureTime: "05:12",
    destination: "Bar",
    detailsUrl: "https://zpcg.me/red-voznje/detalji/6151",
    duration: "59m",
    firstClassPrice: "4.20€",
    secondClassPrice: "2.80€",
    trainNumber: "6151",
  });
});

test("supports heading whitespace variations and stops at the next station", () => {
  const parsed = parseZpcgPodgoricaDepartures(
    '<input value="2026-07-20" name="date"><h3>Polasci&nbsp;iz stanice <span>Podgorica</span></h3><div>Polazak 08:00 Voz: 7100 29m Podgorica Danilovgrad Dolazak 08:29 1. razred 2.70€ 2. razred 1.80€</div><h3>Polasci iz stanice Nikšić</h3><div>Polazak 08:00 Voz: 7100 Nikšić Podgorica Dolazak 09:07</div>',
    "2026-07-20",
  );

  assert.equal(parsed.sectionFound, true);
  assert.equal(parsed.departures.length, 1);
  assert.equal(parsed.departures[0].destination, "Danilovgrad");
});

test("filters already departed trains using the Podgorica local clock", async () => {
  const parsed = parseZpcgPodgoricaDepartures(await readFile(fixture, "utf8"), "2026-07-20");

  assert.deepEqual(
    selectUpcomingRailwayDepartures(parsed.departures, new Date("2026-07-20T05:30:00.000Z")).map(
      ({ departureTime }) => departureTime,
    ),
    ["08:00"],
  );
});

test("retains a valid cache for parser failures and unexpected HTML", async () => {
  const cachePath = await writePreviousSnapshot();
  const diagnostics: ZpcgRefreshDiagnostic[] = [];
  const result = await refreshZpcgRailway({
    cachePath,
    emitDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
    httpClient: responseClient(
      "<html><head><title>Access denied</title></head><body><h1>Maintenance</h1></body></html>",
    ),
    now: () => new Date("2026-07-20T08:00:00.000Z"),
  });

  assert.equal(result.success, false);
  assert.equal(result.errorCode, "zpcg-section-unavailable");
  assert.equal(result.retainedPreviousSnapshot, true);
  const diagnostic = diagnostics.at(-1);
  assert.equal(diagnostic?.provider, "zpcg-railway");
  assert.equal(diagnostic?.phase, "parser");
  assert.equal(diagnostic?.cachePath, cachePath);
  assert.equal(diagnostic?.finalUrl, zpcgTimetableUrl);
  assert.equal(diagnostic?.podgoricaSectionFound, false);
  assert.equal(diagnostic?.rawRowsDetected, 0);
  assert.equal(diagnostic?.acceptedDepartures, 0);
  assert.equal(diagnostic?.rejectedDepartures, 0);
  assert.deepEqual(diagnostic?.headings, ["Maintenance"]);
  assert.equal(diagnostic?.title, "Access denied");
  assert.deepEqual(diagnostic?.error, {
    message: "zpcg-section-unavailable",
    name: "ZpcgRailwayError",
  });
});

test("writes a confirmed empty snapshot only for an explicit empty timetable with a date", async () => {
  const cachePath = join(await mkdtemp(join(tmpdir(), "zpcg-test-")), "railway.json");
  const result = await refreshZpcgRailway({
    cachePath,
    emitDiagnostic: () => undefined,
    httpClient: responseClient(
      '<html><title>Red vožnje</title><input name="date" value="2026-07-20"><h2>Polasci iz stanice Podgorica</h2><p>Nema polazaka za odabrani datum.</p></html>',
    ),
    now: () => new Date("2026-07-20T08:00:00.000Z"),
  });

  assert.equal(result.success, true);
  assert.deepEqual(result.snapshot?.departures, []);
  assert.equal(result.snapshot?.timetableDate, "2026-07-20");
});

test("retains a valid cache after a request failure", async () => {
  const cachePath = await writePreviousSnapshot();
  const result = await refreshZpcgRailway({
    cachePath,
    emitDiagnostic: () => undefined,
    httpClient: {
      get: async () => {
        throw new Error("offline");
      },
    },
  });

  assert.equal(result.success, false);
  assert.equal(result.phase, "request");
  assert.equal(result.retainedPreviousSnapshot, true);
  assert.equal(result.snapshot?.departures[0]?.destination, "Bar");
});

test("includes final URL and HTTP status in diagnostics for an upstream HTTP failure", async () => {
  const diagnostics: ZpcgRefreshDiagnostic[] = [];
  const client = createZpcgHttpClient({
    fetchImplementation: async () => ({
      headers: { get: () => "text/html" },
      ok: false,
      status: 503,
      text: async () => "maintenance",
      url: zpcgTimetableUrl,
    }),
    retries: 0,
  });
  const result = await refreshZpcgRailway({
    cachePath: join(await mkdtemp(join(tmpdir(), "zpcg-test-")), "railway.json"),
    emitDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
    httpClient: client,
  });
  const diagnostic = diagnostics.at(-1);

  assert.equal(result.success, false);
  assert.equal(result.phase, "response");
  assert.equal(diagnostic?.status, 503);
  assert.equal(diagnostic?.finalUrl, zpcgTimetableUrl);
  assert.equal(diagnostic?.requestedUrl, zpcgTimetableUrl);
  assert.deepEqual(diagnostic?.error, {
    message: "ŽPCG returned HTTP 503.",
    name: "ZpcgFetchError",
  });
});

test("retains the cache and logs actual and maximum sizes for an oversized ŽPCG document", async () => {
  const diagnostics: ZpcgRefreshDiagnostic[] = [];
  const client = createZpcgHttpClient({
    fetchImplementation: async () => ({
      headers: { get: () => "text/html" },
      ok: true,
      status: 200,
      text: async () => "x".repeat(2_500_001),
      url: zpcgTimetableUrl,
    }),
    retries: 0,
  });
  const result = await refreshZpcgRailway({
    cachePath: join(await mkdtemp(join(tmpdir(), "zpcg-test-")), "railway.json"),
    emitDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
    httpClient: client,
  });
  const diagnostic = diagnostics.at(-1);

  assert.equal(result.success, false);
  assert.equal(result.errorCode, "zpcg-response-too-large");
  assert.equal(diagnostic?.actualResponseLength, 2_500_001);
  assert.equal(diagnostic?.maximumResponseLength, 2_500_000);
  assert.equal(diagnostic?.status, 200);
});

test("uses the same cache path for atomic refresh writes and homepage reads", async () => {
  const cachePath = join(await mkdtemp(join(tmpdir(), "zpcg-test-")), "nested", "railway.json");
  const result = await refreshZpcgRailway({
    cachePath,
    emitDiagnostic: () => undefined,
    httpClient: responseClient(await readFile(fixture, "utf8")),
    now: () => new Date("2026-07-20T08:00:00.000Z"),
  });
  const cached = await getCachedZpcgRailway(cachePath);

  assert.equal(result.success, true);
  assert.equal(cached.departures.length, 2);
  assert.equal(cached.departures[0].destination, "Bar");
});

test("rejects non-official hosts and non-HTML responses", async () => {
  const client = createZpcgHttpClient({
    fetchImplementation: async () => {
      throw new Error("must not fetch");
    },
  });
  await assert.rejects(() => client.get("https://example.test/timetable"));

  const jsonClient = createZpcgHttpClient({
    fetchImplementation: async () => ({
      headers: { get: () => "application/json" },
      ok: true,
      status: 200,
      text: async () => "{}",
      url: zpcgTimetableUrl,
    }),
  });
  await assert.rejects(() => jsonClient.get(zpcgTimetableUrl));
});

function responseClient(html: string): ZpcgHttpClient {
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

async function writePreviousSnapshot(): Promise<string> {
  const cachePath = join(await mkdtemp(join(tmpdir(), "zpcg-test-")), "railway.json");
  await writeFile(
    cachePath,
    JSON.stringify({
      departures: [
        {
          departureDate: "2026-07-20",
          departureStation: "Podgorica",
          departureTime: "12:55",
          destination: "Bar",
        },
      ],
      fetchedAt: "2026-07-20T08:00:00.000Z",
      freshnessStatus: "fresh",
      lastSuccessfulRefreshAt: "2026-07-20T08:00:00.000Z",
      parserWarnings: [],
      schemaVersion: 1,
      sourceUrl: zpcgTimetableUrl,
      timetableDate: "2026-07-20",
    }),
    "utf8",
  );
  return cachePath;
}
