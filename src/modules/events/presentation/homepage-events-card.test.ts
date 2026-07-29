import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { getCity, getCityName } from "@/shared/config/cities";

test("dashboard events card heading is built per-city, not the shared Podgorica-only translations.heading string", async () => {
  const source = await readFile(new URL("./homepage-events-card.tsx", import.meta.url), "utf8");

  assert.doesNotMatch(source, /\{translations\.heading\}/u);
  assert.match(source, /const heading = `Događaji u \$\{getCityName\(city, "locative"\)\}`;/u);
  assert.match(source, /\{heading\}/u);
});

test("the card heading formula produces the exact required title for Tivat and leaves Podgorica unchanged", () => {
  const getCardHeading = (cityName: string) => `Događaji u ${cityName}`;

  const tivat = getCity("tivat");
  const podgorica = getCity("podgorica");
  assert.ok(tivat);
  assert.ok(podgorica);

  assert.equal(getCardHeading(getCityName(tivat, "locative")), "Događaji u Tivtu");
  assert.equal(getCardHeading(getCityName(podgorica, "locative")), "Događaji u Podgorici");
});
