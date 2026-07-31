import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("uses Gradom.me branding and a root-scoped installed-app identity", async () => {
  const source = await readFile(new URL("../../public/site.webmanifest", import.meta.url), "utf8");
  const manifest = JSON.parse(source) as {
    icons: Array<{ purpose?: string }>;
    id: string;
    name: string;
    scope: string;
    short_name: string;
    start_url: string;
  };

  assert.equal(manifest.id, "/");
  assert.equal(manifest.name, "Gradom.me");
  assert.equal(manifest.short_name, "Gradom.me");
  assert.equal(manifest.start_url, "/");
  assert.equal(manifest.scope, "/");
  assert.ok(manifest.icons.every((icon) => icon.purpose === "any"));
});
