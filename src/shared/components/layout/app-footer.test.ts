import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("derives footer city links from the active city registry and keeps global links canonical", async () => {
  const source = await readFile(new URL("./app-footer.tsx", import.meta.url), "utf8");

  assert.match(source, /getActiveCities\(\)/u);
  assert.match(source, /getCityPath\(city\)/u);
  assert.match(source, /sm:grid-cols-2/u);
  assert.match(source, /lg:grid-cols-\[minmax\(0,1\.45fr\)_repeat\(3,minmax\(0,1fr\)\)\]/u);
  assert.match(source, /getAboutPlatformPath\(\)/u);
  assert.match(source, /getContactPath\(\)/u);
  assert.match(source, /getPrivacyPolicyPath\(\)/u);
  assert.match(source, /getTermsOfUsePath\(\)/u);
  assert.match(source, /href="\/#faq-heading"/u);
  assert.match(source, /Podaci se prikupljaju iz zvaničnih i javno dostupnih izvora/u);
  assert.match(source, /space-y-1\.5/u);
  assert.match(source, /text-center/u);
  assert.match(source, /justify-center/u);
  assert.match(source, /italic/u);
});
