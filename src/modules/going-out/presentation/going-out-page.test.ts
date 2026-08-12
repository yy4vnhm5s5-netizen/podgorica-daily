import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("passes the normalized snapshot image URL straight to public Going Out cards", async () => {
  const source = await readFile(new URL("./going-out-page.tsx", import.meta.url), "utf8");

  assert.match(source, /src=\{event\.imageUrl\}/u);
  assert.match(source, /\bunoptimized\b/u);
});
