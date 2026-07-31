import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("renders City Services as a compact desktop status strip while preserving tabs and links", async () => {
  const source = await readFile(new URL("./city-services-panel.tsx", import.meta.url), "utf8");

  assert.match(source, /flex flex-col lg:flex-row lg:items-stretch/u);
  assert.match(
    source,
    /lg:grid lg:grid-cols-\[minmax\(7\.5rem,0\.8fr\)_minmax\(11rem,1\.35fr\)_auto_minmax\(9\.5rem,1fr\)_auto\]/u,
  );
  assert.match(source, /lg:min-h-9/u);
  assert.match(source, /lg:px-3 lg:py-2/u);
  assert.match(source, /role="tablist"/u);
  assert.match(source, /role="tabpanel"/u);
  assert.match(source, /formatAdditionalAffectedAreas\(service\.additionalLocationCount\)/u);
  assert.match(source, /icon=\{MapPin\}[\s\S]*?iconClassName="text-rose-500"/u);
  assert.match(source, /text-rose-500/u);
  assert.match(source, /icon=\{Clock3\}/u);
  assert.match(source, /\+\{service\.additionalLocationCount\}/u);
  assert.match(source, /href=\{service\.detailsHref\}/u);
  assert.match(source, /href=\{service\.sourceUrl\}/u);
  assert.doesNotMatch(source, /<CardContent/u);
});
