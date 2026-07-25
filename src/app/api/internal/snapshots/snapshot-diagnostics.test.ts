import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { getFileBackedSnapshotDiagnostics } from "./snapshot-diagnostics.ts";

test("reports cache metadata using the same displayability rules as each public module", async () => {
  const directory = await mkdtemp(join(tmpdir(), "snapshot-diagnostics-"));
  const paths = {
    cineplexx: join(directory, "cineplexx.json"),
    flights: join(directory, "flights.json"),
    railway: join(directory, "railway.json"),
  };

  await Promise.all([
    writeFile(
      paths.flights,
      JSON.stringify({
        fetchedAt: "2026-07-25T09:55:00.000Z",
        flights: [
          { direction: "arrival", location: "Beograd", scheduledAt: "2026-07-25T09:00:00.000Z" },
          { direction: "departure", location: "Beč", scheduledAt: "2026-07-25T12:00:00.000Z" },
        ],
      }),
    ),
    writeFile(
      paths.railway,
      JSON.stringify({
        departures: [
          {
            departureDate: "2026-07-25",
            departureStation: "Podgorica",
            departureTime: "11:00",
            destination: "Bar",
          },
          {
            departureDate: "2026-07-26",
            departureStation: "Podgorica",
            departureTime: "00:05",
            destination: "Nikšić",
          },
        ],
        fetchedAt: "2026-07-25T09:55:00.000Z",
      }),
    ),
    writeFile(
      paths.cineplexx,
      JSON.stringify({
        events: [
          { id: "past", startsAt: "2026-07-25T09:00:00.000Z", title: "Prošli" },
          { id: "today", startsAt: "2026-07-25T12:00:00.000Z", title: "Danas" },
          { id: "tomorrow", startsAt: "2026-07-26T12:00:00.000Z", title: "Sjutra" },
        ],
        fetchedAt: "2026-07-25T09:55:00.000Z",
      }),
    ),
  ]);

  const diagnostics = await getFileBackedSnapshotDiagnostics(
    new Date("2026-07-25T10:00:00.000Z"),
    paths,
  );

  assert.deepEqual(
    {
      displayableRecordCount: diagnostics.flights.displayableRecordCount,
      earliestRelevantTimestamp: diagnostics.flights.earliestRelevantTimestamp,
      latestRelevantTimestamp: diagnostics.flights.latestRelevantTimestamp,
      totalRecordCount: diagnostics.flights.totalRecordCount,
    },
    {
      displayableRecordCount: 1,
      earliestRelevantTimestamp: "2026-07-25T09:00:00.000Z",
      latestRelevantTimestamp: "2026-07-25T12:00:00.000Z",
      totalRecordCount: 2,
    },
  );
  assert.equal(diagnostics.railway.relevantTimestampTimeZone, "Europe/Podgorica");
  assert.equal(diagnostics.railway.displayableRecordCount, 1);
  assert.equal(diagnostics.cineplexx.displayableRecordCount, 1);
  assert.equal(diagnostics.cineplexx.totalRecordCount, 3);
});

test("reports an absent module snapshot without failing the combined diagnostic", async () => {
  const directory = await mkdtemp(join(tmpdir(), "snapshot-diagnostics-"));
  const paths = {
    cineplexx: join(directory, "missing-cineplexx.json"),
    flights: join(directory, "missing-flights.json"),
    railway: join(directory, "missing-railway.json"),
  };

  const diagnostics = await getFileBackedSnapshotDiagnostics(
    new Date("2026-07-25T10:00:00.000Z"),
    paths,
  );

  assert.equal(diagnostics.flights.state, "missing");
  assert.equal(diagnostics.railway.state, "missing");
  assert.equal(diagnostics.cineplexx.state, "missing");
});
