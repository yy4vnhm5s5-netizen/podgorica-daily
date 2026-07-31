import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("renders City Services as a compact desktop status strip while preserving tabs and links", async () => {
  const source = await readFile(new URL("./city-services-panel.tsx", import.meta.url), "utf8");

  assert.match(source, /flex flex-col lg:flex-row lg:items-stretch/u);
  assert.match(source, /lg:flex-row lg:items-center lg:gap-0/u);
  assert.match(source, /role="tablist"/u);
  assert.match(source, /role="tabpanel"/u);
  assert.match(source, /formatAdditionalAffectedAreas\(service\.additionalLocationCount\)/u);
  assert.match(source, /href=\{service\.detailsHref\}/u);
  assert.match(source, /href=\{service\.sourceUrl\}/u);
  assert.doesNotMatch(source, /<CardContent/u);
});
