import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { getBusStationTranslations } from "./bus-station-translations.ts";
import { getCity, getCityName } from "@/shared/config/cities";

// "iz" governs the genitive. The card previously passed the bus-station config's nominative
// `cityName`, which rendered "…za putovanja iz Podgorica".
test("the Montenegrin bus-station copy reads with the genitive city form", () => {
  const podgorica = getCity("podgorica");
  assert.ok(podgorica);

  assert.equal(
    getBusStationTranslations("me").description(getCityName(podgorica, "genitive")),
    "Red vožnje i karte za putovanja iz Podgorice.",
  );
});

test("the card supplies the registry form per locale, not the config's nominative", async () => {
  const source = await readFile(new URL("./bus-station-card.tsx", import.meta.url), "utf8");

  assert.match(source, /import \{ getCityName \} from "@\/shared\/config\/cities";/u);
  assert.match(source, /locale === "me" \? "genitive" : "nominative"/u);
  assert.doesNotMatch(source, /description\(config\.cityName\)/u);
  assert.doesNotMatch(source, /"Podgorice"/u);
});

test("the English copy keeps the plain nominative, which is correct for it", () => {
  const podgorica = getCity("podgorica");
  assert.ok(podgorica);

  assert.equal(
    getBusStationTranslations("en").description(getCityName(podgorica, "nominative")),
    "Timetables and tickets for travel from Podgorica.",
  );
});
