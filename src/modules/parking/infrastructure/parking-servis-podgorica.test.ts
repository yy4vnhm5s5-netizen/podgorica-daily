import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  createParkingServisHttpClient,
  parkingAvailabilitySourceUrl,
  parkingCatalogue,
  parseParkingAvailabilityResponse,
  ParkingServisSourceError,
} from "./parking-servis-podgorica.ts";

const fixture = new URL("./__fixtures__/parking-availability.json", import.meta.url);
const now = new Date("2026-08-11T10:00:00.000Z");

test("keeps the source-backed Parking servis Podgorica catalogue explicit", () => {
  assert.deepEqual(
    parkingCatalogue.map(({ capacity, name, sourceId, type }) => ({
      capacity,
      name,
      sourceId,
      type,
    })),
    [
      { capacity: 320, name: "Parking br. 1 – Kasarna Morača", sourceId: "broj1", type: "parking" },
      { capacity: 74, name: "Parking br. 2 – Beko", sourceId: "broj2", type: "parking" },
      { capacity: 24, name: "Parking br. 2a – Trg Balšića", sourceId: "broj2a", type: "parking" },
      { capacity: 84, name: "Parking br. 3 – Stadion zapad", sourceId: "broj3", type: "parking" },
      {
        capacity: 195,
        name: "Parking br. 5 – Sportski centar",
        sourceId: "broj5",
        type: "parking",
      },
      { capacity: 124, name: "Parking br. 6 – Mala pijaca", sourceId: "broj6", type: "parking" },
      { capacity: 170, name: "Parking br. 8 – KBC parking", sourceId: "broj8", type: "parking" },
      { capacity: 120, name: "Parking br. 9 – Pod Goricom", sourceId: "broj9", type: "parking" },
      {
        capacity: 45,
        name: "Parking br. 11 – Serdara Jola Piletića (kod Uprave policije)",
        sourceId: "broj11",
        type: "parking",
      },
      { capacity: 94, name: "Parking br. 12 – Blok V", sourceId: "broj12", type: "parking" },
      { capacity: 97, name: "Garaža br. 1 – Novaka Miloševa", sourceId: "garaza1", type: "garage" },
      { capacity: 109, name: "Garaža br. 2 – Karađorđeva", sourceId: "garaza2", type: "garage" },
      {
        capacity: 203,
        name: "Garaža br. 3 – arh. Milana Popovića",
        sourceId: "garaza3",
        type: "garage",
      },
      { capacity: 351, name: "Garaža br. 4 – TC Bazar", sourceId: "garaza4", type: "garage" },
    ],
  );
});

test("accepts valid JSON returned with the official endpoint's incorrect text/html content type", async () => {
  const body = await readFile(fixture, "utf8");
  const client = createParkingServisHttpClient({
    fetchImplementation: async (url) => {
      assert.equal(url, parkingAvailabilitySourceUrl);
      return {
        headers: { get: () => "text/html; charset=UTF-8" },
        ok: true,
        status: 200,
        text: async () => body,
      };
    },
  });

  const response = await client.get();
  const parsed = parseParkingAvailabilityResponse(response.body, { now });

  assert.equal(response.contentType, "text/html; charset=UTF-8");
  assert.deepEqual(
    parsed.locations.map(({ sourceId }) => sourceId),
    ["broj1", "broj2", "broj2a"],
  );
  assert.equal(parsed.locations[1]?.freeSpaces, 53);
});

test("rejects malformed JSON and malformed top-level payloads", () => {
  assert.throws(
    () => parseParkingAvailabilityResponse("<html>not JSON</html>", { now }),
    (error: unknown) =>
      error instanceof ParkingServisSourceError && error.code === "parking-response-invalid-json",
  );
  assert.throws(
    () => parseParkingAvailabilityResponse(JSON.stringify({ locations: [] }), { now }),
    (error: unknown) =>
      error instanceof ParkingServisSourceError &&
      error.code === "parking-response-invalid-payload",
  );
});

test("rejects a valid array with no usable known locations instead of clearing the prior snapshot", () => {
  assert.throws(
    () =>
      parseParkingAvailabilityResponse(
        JSON.stringify([
          { name: "unknown", parking_id: "unknown", slobodnih_mjesta: 5, time_updated: 1786442100 },
        ]),
        { now },
      ),
    (error: unknown) =>
      error instanceof ParkingServisSourceError &&
      error.code === "parking-response-no-valid-locations",
  );
});

test("keeps valid known records while rejecting unknown, duplicate and invalid values independently", () => {
  const parsed = parseParkingAvailabilityResponse(
    JSON.stringify([
      { name: null, parking_id: "broj1", slobodnih_mjesta: 5, time_updated: 1786442100 },
      { name: "duplicate", parking_id: "broj1", slobodnih_mjesta: 6, time_updated: 1786442100 },
      { name: "unknown", parking_id: "unknown", slobodnih_mjesta: 5, time_updated: 1786442100 },
      { name: "negative", parking_id: "broj2", slobodnih_mjesta: -1, time_updated: 1786442100 },
      {
        name: "over capacity",
        parking_id: "broj2a",
        slobodnih_mjesta: 25,
        time_updated: 1786442100,
      },
      { name: "invalid time", parking_id: "broj3", slobodnih_mjesta: 1, time_updated: 1.5 },
      { name: "future", parking_id: "broj5", slobodnih_mjesta: 1, time_updated: 1786443301 },
      { name: "valid", parking_id: "garaza1", slobodnih_mjesta: 12, time_updated: 1786442100 },
    ]),
    { now },
  );

  assert.deepEqual(parsed.locations, [
    {
      freeSpaces: 12,
      sourceId: "garaza1",
      sourceUpdatedAt: new Date(1786442100 * 1000).toISOString(),
    },
  ]);
  assert.deepEqual(parsed.warnings, [
    "duplicate-parking-id:1",
    "unknown-parking-id:1",
    "invalid-free-spaces:2",
    "invalid-timestamp:2",
    "missing-expected-locations:13",
  ]);
});
