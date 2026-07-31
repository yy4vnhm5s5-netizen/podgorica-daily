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
