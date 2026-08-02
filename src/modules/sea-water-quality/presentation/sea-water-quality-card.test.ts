import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("renders the shared sea-water summary count and metadata as a compact status block", async () => {
  const source = await readFile(new URL("./sea-water-quality-card.tsx", import.meta.url), "utf8");

  assert.match(
    source,
    /text-sm font-medium uppercase leading-5 tracking-\[0\.16em\] text-slate-800/u,
  );
  assert.match(source, /Kvalitet mora/u);
  assert.match(source, /\{summary\.totalLocations\}/u);
  assert.match(source, /kupališta pod monitoringom/u);
  assert.doesNotMatch(source, /Kupališta pod zvaničnim monitoringom/u);
  assert.match(source, /mt-3 space-y-0\.5 text-xs leading-5 text-muted-foreground/u);
  assert.match(source, /Izvor:/u);
  assert.match(source, /<p className="italic">/u);
  assert.match(source, /JPMD/u);
  assert.match(source, /href=\{sourceUrl\}/u);
  assert.match(source, /rel="noopener noreferrer"/u);
  assert.match(source, /target="_blank"/u);
  assert.match(source, /Uzorkovanje:/u);
  assert.match(source, /Posljednje osvježenje:/u);
});
