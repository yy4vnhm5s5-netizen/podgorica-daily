import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { getCanonicalMainCityPath } from "./root-redirect.ts";

test("uses the canonical main-city landing page as the root redirect target", () => {
  assert.equal(getCanonicalMainCityPath(), "/podgorica");
});

test("uses Next.js permanent redirect for the root route", async () => {
  const source = await readFile(new URL("./page.tsx", import.meta.url), "utf8");

  assert.match(source, /permanentRedirect\(getCanonicalMainCityPath\(\)\)/u);
});
