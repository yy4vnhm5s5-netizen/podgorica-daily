import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("events loading exposes one status region and keeps visual skeletons decorative", async () => {
  const source = await readFile(new URL("./loading.tsx", import.meta.url), "utf8");

  assert.equal((source.match(/role="status"/g) ?? []).length, 1);
  assert.equal((source.match(/announce=\{false\}/g) ?? []).length, 3);
});
