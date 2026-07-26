import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { createPlatformCityCardData, formatCityNames } from "./platform-homepage-data.ts";
import { createCityContext } from "@/shared/config/cities";

test("uses semantic, keyboard-accessible city-card links without nested controls", async () => {
  const source = await readFile(new URL("./platform-homepage.tsx", import.meta.url), "utf8");

  assert.match(source, /<article className=/u);
  assert.match(source, /aria-label=\{`Otvori grad \$\{card\.city\.name\}`\}/u);
  assert.match(source, /focus-visible:ring-2 focus-visible:ring-primary/u);
  assert.match(source, /card\.highlights\.map/u);
  assert.match(source, /card\.shortcuts\.map/u);
  assert.match(source, /<details/u);
  assert.doesNotMatch(source, />Crna Gora</u);
  assert.match(source, /Gradom\.me trenutno podržava \{cityNames\}/u);
});

test("lists all active public cities in the FAQ sentence", () => {
  const cards = [
    createPlatformCityCardData(createCityContext("podgorica"), null),
    createPlatformCityCardData(createCityContext("budva"), null),
  ];

  assert.equal(formatCityNames(cards), "Podgoricu i Budvu");
});
