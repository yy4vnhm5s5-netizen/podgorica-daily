import assert from "node:assert/strict";
import test from "node:test";
import { discoverTourismEventUrls, parseTourismEventArticle } from "./tourism-event-parser.ts";
test("parses official-style Tourism calendar links and event fields", () => {
  assert.deepEqual(
    discoverTourismEventUrls(
      '<a href="/dogadjaj/koncert/">Detalji</a><a href="https://evil.test/x">x</a><a href="/dogadjaj/koncert/">again</a>',
    ),
    ["https://podgorica.travel/dogadjaj/koncert/"],
  );
  const parsed = parseTourismEventArticle(
    '<h1>Koncert u parku</h1><p>20.07.2026. 21:00 – 23:00h. Lokacija: Univerzitetski park. Organizator: Turistička organizacija Podgorice.</p><img src="https://podgorica.travel/a.jpg">',
    "https://podgorica.travel/dogadjaj/koncert/",
  ).candidate;
  assert.equal(parsed.startsAt, "2026-07-20T19:00:00.000Z");
  assert.equal(parsed.endsAt, "2026-07-20T21:00:00.000Z");
  assert.equal(parsed.rawVenue, "Univerzitetski park");
  assert.equal(parsed.organizer, "Turistička organizacija Podgorice");
  assert.equal(parsed.categoryHint, "concert");
});
