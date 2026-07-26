import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("uses semantic, keyboard-accessible city-card links without nested controls", async () => {
  const source = await readFile(new URL("./platform-homepage.tsx", import.meta.url), "utf8");

  assert.match(source, /<article className=/u);
  assert.match(source, /aria-label=\{`Otvori grad \$\{card\.city\.name\}`\}/u);
  assert.match(source, /focus-visible:ring-2 focus-visible:ring-primary/u);
  assert.match(source, /card\.highlights\.map/u);
  assert.match(source, /card\.shortcuts\.map/u);
  assert.match(source, /<details/u);
});
