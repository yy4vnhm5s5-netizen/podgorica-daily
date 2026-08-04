import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { getActiveCities, getCity, getCityName } from "@/shared/config/cities";

// Regression test for "Informacije o događaju … u Podgorica." — the preposition "u" governs the
// locative, so the nominative `city.name` was grammatically wrong in the fallback description.
test("builds the fallback description with the locative city form", async () => {
  const source = await readFile(new URL("./page.tsx", import.meta.url), "utf8");

  assert.match(
    source,
    /`Informacije o događaju \$\{event\.title\} u \$\{getCityName\(context\.city, "locative"\)\}\.`/u,
  );
  assert.doesNotMatch(source, /u \$\{context\.city\.name\}/u);
  assert.doesNotMatch(source, /Podgoric[ai]"/u, "no city form may be hardcoded on this route");
});

test("resolves to a grammatical sentence for every active city", () => {
  const podgorica = getCity("podgorica");
  assert.ok(podgorica);
  assert.equal(
    `Informacije o događaju Primjer u ${getCityName(podgorica, "locative")}.`,
    "Informacije o događaju Primjer u Podgorici.",
  );

  for (const city of getActiveCities()) {
    const description = `Informacije o događaju Primjer u ${getCityName(city, "locative")}.`;

    assert.doesNotMatch(description, new RegExp(`u ${city.name}\\.$`, "u"), city.id);
    assert.equal(description.endsWith(`u ${city.locativeName ?? city.name}.`), true, city.id);
  }
});

test("only the fallback description changed — title, canonical and JSON-LD are untouched", async () => {
  const source = await readFile(new URL("./page.tsx", import.meta.url), "utf8");

  // The description is still only a fallback for a provider that supplied none.
  assert.match(source, /const description =\n\s+event\.description \?\?/u);
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
