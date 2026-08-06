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

const footerSource = async () => readFile(new URL("./app-footer.tsx", import.meta.url), "utf8");

// The column a row belongs to, sliced out of the source so a match cannot come from elsewhere.
const columns = async () => {
  const source = await footerSource();
  const platformStart = source.indexOf("footer-platform-heading");
  const trackedStart = source.indexOf("footer-tracked-heading");
  assert.notEqual(platformStart, -1);
  assert.notEqual(trackedStart, -1);
  return {
    platform: source.slice(platformStart, trackedStart),
    tracked: source.slice(trackedStart),
  };
};

test("Cijene goriva sits under Šta pratimo, not in the Platforma column", async () => {
  const { platform, tracked } = await columns();

  assert.match(tracked, /<FooterLink href=\{getFuelPricesPath\(\)\}>Cijene goriva<\/FooterLink>/u);
  // Moved, not duplicated.
  assert.doesNotMatch(platform, /getFuelPricesPath|Cijene goriva/u);
});

test("exactly one footer link points to the fuel page", async () => {
  const source = await footerSource();

  // One import plus one use: no second anchor anywhere in the footer.
  assert.equal([...source.matchAll(/getFuelPricesPath\(\)/gu)].length, 1);
  assert.equal([...source.matchAll(/Cijene goriva/gu)].length, 1);
  assert.doesNotMatch(source, /href="\/gorivo"/u);
});

test("the fuel row disappears cleanly when the feature is disabled", async () => {
  const { tracked } = await columns();

  // The flag wraps the list item itself, so a disabled feature leaves no empty <li> behind.
  assert.match(tracked, /\{isFeatureEnabled\("fuelPrices"\) \? \(\s*<li>/u);
  assert.match(tracked, /<\/li>\s*\) : null\}/u);
});

test("the fuel row is an ordinary crawlable anchor", async () => {
  const source = await footerSource();

  // FooterLink renders next/link; nothing here opts out of crawling or navigates by script.
  assert.match(source, /<Link className=\{`\$\{footerLinkClassName\}/u);
  assert.doesNotMatch(source, /nofollow/u);
  assert.doesNotMatch(source, /target="_blank"/u);
  assert.doesNotMatch(source, /onClick/u);
});

test("city-scoped concepts stay plain text, having no national landing page", async () => {
  const { tracked } = await columns();

  // Events, flights and beaches exist only under /[city]/…, so these rows link nowhere.
  const plainRows = ["Gradske usluge", "Događaji", "Letovi", "Kupališta", "Lokalne informacije"];
  for (const label of plainRows) {
    assert.match(tracked, new RegExp(`<li>${label}</li>`, "u"), `${label} must stay plain text`);
  }
  for (const helper of ["getEventsPath", "getFlightsPath", "getSeaWaterQualityPath"]) {
    assert.doesNotMatch(tracked, new RegExp(helper, "u"), `${helper} has no national landing page`);
  }
});

