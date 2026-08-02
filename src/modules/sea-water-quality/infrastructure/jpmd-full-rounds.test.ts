import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

interface JpmdMeasurement {
  id: number;
  kalendar: number;
  naziv: string;
  ocjena: string;
  opstina: string;
  plaza: string | null;
}

interface JpmdRound {
  mjerenja: JpmdMeasurement[];
  ukupno: number;
}

async function readRound(name: string): Promise<JpmdRound> {
  return JSON.parse(
    await readFile(new URL(`./__fixtures__/${name}`, import.meta.url), "utf8"),
  ) as JpmdRound;
}

test("keeps complete official JPMD rounds as stable raw identity evidence", async () => {
  const [round4, round5] = await Promise.all([
    readRound("jpmd-2026-round-4-full.json"),
    readRound("jpmd-2026-round-5-full.json"),
  ]);

  assert.equal(round4.ukupno, 114);
  assert.equal(round4.mjerenja.length, 114);
  assert.equal(round5.ukupno, 114);
  assert.equal(round5.mjerenja.length, 114);
  assert.equal(
    round4.mjerenja.every((measurement) => measurement.kalendar === 4),
    true,
  );
  assert.equal(
    round5.mjerenja.every((measurement) => measurement.kalendar === 5),
    true,
  );

  const byId4 = new Map(round4.mjerenja.map((measurement) => [measurement.id, measurement]));
  const byId5 = new Map(round5.mjerenja.map((measurement) => [measurement.id, measurement]));
  assert.deepEqual(
    [...byId4.keys()].sort((left, right) => left - right),
    [...byId5.keys()].sort((left, right) => left - right),
  );

  const changes = round5.mjerenja.filter((measurement) => {
    const previous = byId4.get(measurement.id);
    assert.ok(previous);
    assert.equal(previous.naziv, measurement.naziv);
    assert.equal(previous.plaza, measurement.plaza);
    assert.equal(previous.opstina, measurement.opstina);
    return previous.ocjena !== measurement.ocjena;
  });

  assert.equal(changes.length, 28);
});
