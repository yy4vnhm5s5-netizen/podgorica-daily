import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  budvaMunicipalityId,
  buildMapDataRequestBody,
  parseBudvaSeaWaterQualitySummary,
  parseCurrentRoundId,
} from "./budva-sea-water-quality.ts";
import { seaWaterQualityMunicipalities } from "./sea-water-quality-cities.ts";

async function readFixture(name: string) {
  return readFile(new URL(`./__fixtures__/${name}`, import.meta.url), "utf8");
}

test("parses the currently selected round from a real calendar-data response", async () => {
  const body = await readFixture("morskodobro-calendar-data.json");
  assert.equal(parseCurrentRoundId(body), 5);
});

test("falls back to the newest round id when odabraniKalendar is missing", () => {
  const body = JSON.stringify({
    data: [{ id: 1 }, { id: 3 }, { id: 2 }],
  });
  assert.equal(parseCurrentRoundId(body), 3);
});

test("returns undefined for a calendar response that cannot be recognized", () => {
  assert.equal(parseCurrentRoundId("not json"), undefined);
  assert.equal(parseCurrentRoundId(JSON.stringify({ unexpected: true })), undefined);
});

test("normalizes a real Budva crtajMapu response into a sea water quality summary", async () => {
  const body = await readFixture("morskodobro-budva-map-data.json");
  const parsed = parseBudvaSeaWaterQualitySummary(body);

  assert.deepEqual(parsed?.summary.gradeCounts, {
    excellent: 27,
    good: 2,
    poor: 2,
    satisfactory: 3,
  });
  assert.equal(parsed?.summary.latestSamplingDate, "2026-07-23");
  assert.equal(parsed?.summary.municipality, "budva");
  assert.equal(parsed?.summary.totalLocations, 34);
  assert.deepEqual(parsed?.summary.locations, [
    { grade: "excellent", id: 36, name: "Jaz 01", samplingDate: "2026-07-21" },
    { grade: "poor", id: 30, name: "Slovenska plaža 01", samplingDate: "2026-07-23" },
    { grade: "satisfactory", id: 28, name: "Slovenska plaža 03", samplingDate: "2026-07-21" },
    { grade: "good", id: 40, name: "Sv. Stefan plaža 02", samplingDate: "2026-07-21" },
  ]);
  assert.deepEqual(parsed?.warnings, []);
});

test("returns undefined for a map response that cannot be recognized", () => {
  assert.equal(parseBudvaSeaWaterQualitySummary("not json"), undefined);
  assert.equal(parseBudvaSeaWaterQualitySummary(JSON.stringify({ unexpected: true })), undefined);
});

test("omits latestSamplingDate when no measurement has a parseable date", () => {
  const body = JSON.stringify({
    mjerenja: [
      { datumUzorkovanja: "not-a-date", id: 1, naziv: "Jaz 01", opstina: "Budva", tezina: 1 },
    ],
    sumarno: [[1, 1]],
    ukupno: 1,
  });
  const parsed = parseBudvaSeaWaterQualitySummary(body);
  assert.equal(parsed?.summary.latestSamplingDate, undefined);
  assert.deepEqual(parsed?.summary.gradeCounts, {
    excellent: 1,
    good: 0,
    poor: 0,
    satisfactory: 0,
  });
  assert.deepEqual(parsed?.summary.locations, [{ grade: "excellent", id: 1, name: "Jaz 01" }]);
});

test("surfaces a warning, excludes the location, and keeps processing when sumarno contains an unrecognized tezina", () => {
  const body = JSON.stringify({
    mjerenja: [
      { datumUzorkovanja: "01.08.2026", id: 1, naziv: "Jaz 01", opstina: "Budva", tezina: 1 },
      {
        datumUzorkovanja: "01.08.2026",
        id: 2,
        naziv: "Mystery Beach",
        opstina: "Budva",
        tezina: 5,
      },
    ],
    sumarno: [
      [1, 30],
      [5, 2],
    ],
    ukupno: 32,
  });
  const parsed = parseBudvaSeaWaterQualitySummary(body);

  assert.deepEqual(parsed?.summary.gradeCounts, {
    excellent: 30,
    good: 0,
    poor: 0,
    satisfactory: 0,
  });
  assert.equal(parsed?.summary.totalLocations, 32);
  assert.deepEqual(parsed?.summary.locations, [
    { grade: "excellent", id: 1, name: "Jaz 01", samplingDate: "2026-08-01" },
  ]);
  assert.deepEqual(parsed?.warnings, ["sea-water-quality-unknown-tezina:5"]);
});

test("builds the Budva map-data request with the confirmed stable municipality id", () => {
  const body = buildMapDataRequestBody({
    municipalityId: budvaMunicipalityId,
    round: 5,
    year: 2026,
  });
  assert.equal(budvaMunicipalityId, 2);
  assert.equal(body.get("opstina"), "2");
  assert.equal(body.get("godina"), "2026");
  assert.equal(body.get("rb"), "5");
});

test("builds the Tivat map-data request with the confirmed stable municipality id", () => {
  const tivatMunicipalityId = seaWaterQualityMunicipalities.tivat.municipalityId;
  const body = buildMapDataRequestBody({
    municipalityId: tivatMunicipalityId,
    round: 5,
    year: 2026,
  });
  assert.equal(tivatMunicipalityId, 3);
  assert.equal(body.get("opstina"), "3");
});

test("builds the Kotor map-data request with the confirmed stable municipality id", () => {
  const kotorMunicipalityId = seaWaterQualityMunicipalities.kotor.municipalityId;
  const body = buildMapDataRequestBody({
    municipalityId: kotorMunicipalityId,
    round: 5,
    year: 2026,
  });
  assert.equal(kotorMunicipalityId, 4);
  assert.equal(body.get("opstina"), "4");
});

test("normalizes a real Tivat crtajMapu response and stamps it with the Tivat municipality", async () => {
  const body = await readFixture("morskodobro-tivat-map-data.json");
  const parsed = parseBudvaSeaWaterQualitySummary(body, "tivat");

  assert.equal(parsed?.summary.municipality, "tivat");
  assert.equal(parsed?.summary.totalLocations, 10);
  assert.deepEqual(parsed?.summary.gradeCounts, {
    excellent: 7,
    good: 1,
    poor: 0,
    satisfactory: 2,
  });
  assert.equal(parsed?.summary.latestSamplingDate, "2026-07-21");
  assert.deepEqual(
    parsed?.summary.locations.map(({ grade, id, name }) => ({ grade, id, name })),
    [
      { grade: "satisfactory", id: 90, name: "Opatovo 01" },
      { grade: "satisfactory", id: 89, name: "Donja Lastva 01" },
      { grade: "good", id: 88, name: "Seljanovo 01" },
      { grade: "excellent", id: 87, name: "Gradska plaža 01" },
      { grade: "excellent", id: 86, name: "Kalardovo 01" },
      { grade: "excellent", id: 85, name: "Solila 01" },
      { grade: "excellent", id: 84, name: "Krašići 01" },
      { grade: "excellent", id: 83, name: "Oblatno 01" },
      { grade: "excellent", id: 124, name: "VELJA ŠPILJA" },
      { grade: "excellent", id: 82, name: "Uvala Pržno" },
    ],
  );
  assert.deepEqual(parsed?.warnings, []);
});

test("normalizes the Kotor crtajMapu fixture and stamps it with the Kotor municipality", async () => {
  const body = await readFixture("morskodobro-kotor-map-data.json");
  const parsed = parseBudvaSeaWaterQualitySummary(body, "kotor");

  assert.equal(parsed?.summary.municipality, "kotor");
  assert.equal(parsed?.summary.totalLocations, 15);
  assert.deepEqual(parsed?.summary.gradeCounts, {
    excellent: 10,
    good: 2,
    poor: 0,
    satisfactory: 3,
  });
  assert.equal(parsed?.summary.latestSamplingDate, "2026-07-23");
  assert.deepEqual(
    parsed?.summary.locations.map(({ grade, id, name }) => ({ grade, id, name })),
    [
      { grade: "excellent", id: 99, name: "Dobrota 01" },
      { grade: "good", id: 100, name: "Dražin vrt 01" },
      { grade: "satisfactory", id: 63, name: "Perast 01" },
      { grade: "excellent", id: 65, name: "Risan 01" },
    ],
  );
  assert.deepEqual(parsed?.warnings, []);
});
