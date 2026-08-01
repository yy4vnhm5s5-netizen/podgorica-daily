import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("renders every city tab as a server-visible link while retaining in-place tab selection", async () => {
  const source = await readFile(new URL("./platform-city-selector.tsx", import.meta.url), "utf8");

  assert.match(source, /import Link from "next\/link"/u);
  assert.match(source, /<Link[\s\S]*?href=\{card\.href\}[\s\S]*?role="tab"/u);
  assert.match(source, /event\.preventDefault\(\);[\s\S]*?selectCity\(cityId\);/u);
  assert.match(
    source,
    /event\.metaKey \|\| event\.altKey \|\| event\.ctrlKey \|\| event\.shiftKey/u,
  );
});

test("wraps city chips on mobile while retaining the desktop single-row selector", async () => {
  const source = await readFile(new URL("./platform-city-selector.tsx", import.meta.url), "utf8");

  assert.match(source, /className="px-1 sm:-mx-1 sm:overflow-x-auto sm:px-1 sm:pb-1"/u);
  assert.match(source, /flex flex-wrap gap-1[\s\S]*?sm:min-w-max sm:flex-nowrap/u);
  assert.doesNotMatch(source, /className="-mx-1 overflow-x-auto/u);
  assert.match(source, /cards\.map\(\(card\) =>/u);
  assert.match(source, /bg-background text-foreground shadow-sm/u);
});
