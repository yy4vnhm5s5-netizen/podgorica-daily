import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { createPlatformCityCardData, formatCityNames } from "./platform-homepage-data.ts";
import { createCityContext, getActiveCities, getCityName } from "@/shared/config/cities";

test("keeps city cards and the FAQ semantically accessible", async () => {
  const [cityCardSource, homepageSource] = await Promise.all([
    readFile(new URL("./platform-city-panel.tsx", import.meta.url), "utf8"),
    readFile(new URL("./platform-homepage.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(cityCardSource, /<article/u);
  assert.match(
    cityCardSource,
    /aria-label=\{`Otvori grad \$\{getCityName\(card\.city, "accusative"\)\}`\}/u,
  );
  assert.match(cityCardSource, /focus-visible:ring-2 focus-visible:ring-primary/u);
  assert.match(cityCardSource, /card\.highlights\.map/u);
  assert.match(cityCardSource, /card\.shortcuts\.map/u);
  assert.match(cityCardSource, /sm:grid-cols-4/u);
  assert.match(homepageSource, /function PlatformMark/u);
  assert.match(homepageSource, /<details/u);
  assert.match(homepageSource, /faqItems\.map/u);
  assert.match(homepageSource, /String\(index\)\.padStart\(2, "0"\)/u);
  assert.match(homepageSource, /aria-controls=\{`faq-answer-\$\{index\}`\}/u);
  assert.match(homepageSource, /group-open:hidden/u);
  assert.match(homepageSource, /group-open:inline/u);
  assert.match(homepageSource, /font-display text-xl font-semibold leading-snug tracking-normal/u);
  assert.doesNotMatch(homepageSource, />Crna Gora</u);
  assert.match(homepageSource, /Gradom\.me trenutno podržava \{cityNames\}/u);
});

test("lists all active public cities in the FAQ sentence", () => {
  const cards = [
    createPlatformCityCardData(createCityContext("podgorica"), null),
    createPlatformCityCardData(createCityContext("budva"), null),
  ];

  assert.equal(formatCityNames(cards), "Podgoricu i Budvu");
});

test("joins multiple active cities with a comma before the final 'i'", () => {
  const cards = [
    createPlatformCityCardData(createCityContext("podgorica"), null),
    createPlatformCityCardData(createCityContext("budva"), null),
    createPlatformCityCardData(createCityContext("kotor"), null),
    createPlatformCityCardData(createCityContext("tivat"), null),
  ];

  assert.equal(formatCityNames(cards), "Podgoricu, Budvu, Kotor i Tivat");
});

test("city-aware homepage copy agrees in case with the phrase governing it", () => {
  // "Otvori grad …" and "za grad …" both take an accusative object. Only Podgorica and Budva
  // differ between nominative and accusative, which is how the nominative survived in both the
  // card's accessible name and the city-hub description.
  for (const city of getActiveCities()) {
    const accusative = getCityName(city, "accusative");

    assert.notEqual(accusative, "", city.id);
    assert.equal(`Otvori grad ${accusative}`, `Otvori grad ${city.accusativeName ?? city.name}`);
  }

  const podgorica = getActiveCities().find(({ id }) => id === "podgorica");
  const budva = getActiveCities().find(({ id }) => id === "budva");
  assert.ok(podgorica && budva);
  // The two that actually decline — pinned so a regression to the bare name is visible.
  assert.equal(getCityName(podgorica, "accusative"), "Podgoricu");
  assert.equal(getCityName(budva, "accusative"), "Budvu");
});

test("the homepage exposes exactly the registry's active cities", async () => {
  const source = await readFile(new URL("./platform-homepage-data.ts", import.meta.url), "utf8");
  const active = getActiveCities();

  // Six today, but derived rather than hardcoded: the card list comes from the registry.
  assert.match(source, /cities: readonly City\[\] = getActiveCities\(\)/u);
  assert.equal(active.length, 6);
  assert.deepEqual(
    active.map(({ id }) => id).sort(),
    ["bar", "budva", "kotor", "podgorica", "tivat", "ulcinj"],
  );
  assert.equal(
    active.some(({ isActive }) => !isActive),
    false,
  );
});
