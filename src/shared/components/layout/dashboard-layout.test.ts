import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("adds one shared return link for city-scoped layouts only", async () => {
  const source = await readFile(new URL("./dashboard-layout.tsx", import.meta.url), "utf8");

  assert.match(source, /const isCityScoped = homeHref === undefined/u);
  assert.match(source, /Povratak na izbor gradova/u);
  assert.match(source, /href="\/"/u);
  assert.match(source, /<Button asChild className="mb-6 rounded-lg" size="sm" variant="outline">/u);
  assert.match(source, /<ArrowLeft aria-hidden="true" className="size-4" \/>/u);
});
