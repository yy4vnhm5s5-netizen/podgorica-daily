import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { getActiveCities, getCity, getCityName } from "@/shared/config/cities";

// Regression test for "Informacije o događaju … u Podgorica." — the preposition "u" governs the
// locative, so the nominative `city.name` was grammatically wrong in the fallback description.
test("builds event metadata through the bounded shared description generator", async () => {
  const source = await readFile(new URL("./page.tsx", import.meta.url), "utf8");

  assert.match(source, /import \{ createEventDetailMetadataDescription \} from/u);
  assert.match(
    source,
    /const description = createEventDetailMetadataDescription\(\{ cityLocative, event, eventDay \}\);/u,
  );
  assert.doesNotMatch(source, /event\.description \?\?/u);
});

test("resolves the grammatical locative form for every active city", () => {
  const podgorica = getCity("podgorica");
  assert.ok(podgorica);
  assert.equal(
    `Događaj Primjer u ${getCityName(podgorica, "locative")}.`,
    "Događaj Primjer u Podgorici.",
  );

  for (const city of getActiveCities()) {
    const description = `Događaj Primjer u ${getCityName(city, "locative")}.`;

    assert.doesNotMatch(description, new RegExp(`u ${city.name}\\.$`, "u"), city.id);
    assert.equal(description.endsWith(`u ${city.locativeName ?? city.name}.`), true, city.id);
  }
});

test("description generation leaves title, canonical and JSON-LD untouched", async () => {
  const source = await readFile(new URL("./page.tsx", import.meta.url), "utf8");

  assert.match(source, /canonical: getEventDetailPath\(context\.city, event\.id\),/u);
  assert.match(source, /title: getPageTitle\(getEventDetailPageTitle\(event, context\.city\)\)/u);
  assert.match(source, /createEventStructuredData\(event\)/u);
  assert.match(source, /createEventBreadcrumbStructuredData\(context\.city, event\)/u);
  // Expired-event lifecycle: unknown IDs still 404, and the detail component still derives its
  // own ended state rather than being gated here.
  assert.match(source, /if \(!event\) notFound\(\);/u);
  assert.match(
    source,
    /<EventDetail city=\{context\.city\} event=\{event\} locale=\{locale\} \/>/u,
  );
});
