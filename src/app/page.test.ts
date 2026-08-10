import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("renders the platform homepage rather than redirecting to the Podgorica dashboard", async () => {
  const source = await readFile(new URL("./page.tsx", import.meta.url), "utf8");

  assert.match(source, /<PlatformHomepage cards=\{cards\} fuel=\{fuel\} \/>/u);
  assert.doesNotMatch(source, /permanentRedirect|CityDashboard/u);
  assert.match(source, /homeHref="\/"/u);
  assert.match(source, /export const revalidate = 0/u);
});
