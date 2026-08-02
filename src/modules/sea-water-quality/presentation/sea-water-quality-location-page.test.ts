import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("renders user-facing beach history without exposing the raw JPMD source round", async () => {
  const source = await readFile(
    new URL("./sea-water-quality-location-page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /Kvalitet vode/u);
  assert.match(source, /Datum uzorkovanja/u);
  assert.match(source, /measurement\.samplingDateTime \?\? measurement\.samplingDate \?\? "—"/u);
  assert.doesNotMatch(source, />\s*Krug monitoringa\s*</u);
  assert.doesNotMatch(source, /\{measurement\.sourceRound\}<\/td>/u);
});

test("uses the compact linked JPMD source attribution", async () => {
  const source = await readFile(
    new URL("./sea-water-quality-location-page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /<p className="text-sm italic text-muted-foreground">/u);
  assert.match(source, /Izvor:/u);
  assert.match(source, />\s*JPMD\s*</u);
  assert.match(source, /href=\{sourceUrl\}/u);
  assert.match(source, /rel="noopener noreferrer"/u);
  assert.match(source, /target="_blank"/u);
});
