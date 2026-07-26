import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("adds one shared return link for city-scoped layouts only", async () => {
  const source = await readFile(new URL("./dashboard-layout.tsx", import.meta.url), "utf8");

  assert.match(source, /const isCityScoped = homeHref === undefined/u);
  assert.match(source, /Povratak na izbor gradova/u);
  assert.match(source, /href="\/"/u);
});

test("passes the optional platform-only brand treatment to the header", async () => {
  const source = await readFile(new URL("./dashboard-layout.tsx", import.meta.url), "utf8");

  assert.match(source, /brandVariant\?: "default" \| "platform"/u);
  assert.match(source, /brandVariant=\{brandVariant\}/u);
});
