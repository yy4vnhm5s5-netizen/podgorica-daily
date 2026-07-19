import assert from "node:assert/strict";
import test from "node:test";
import { discoverTourismEventUrls, parseTourismEventArticle } from "./tourism-event-parser.ts";
test("parses official-style Tourism calendar links and event fields", () => {
  assert.deepEqual(
    discoverTourismEventUrls(
      '<a href="/calendar-event/koncert/">Detalji</a><a href="/dogadjaj/legacy/">legacy</a><a href="https://evil.test/x">x</a><a href="/calendar-event/koncert/">again</a>',
    ),
    ["https://podgorica.travel/calendar-event/koncert/"],
  );
  const parsed = parseTourismEventArticle(
    '<h1>Koncert u parku</h1><p>20.07.2026. 21:00 – 23:00h. Lokacija: Univerzitetski park. Organizator: Turistička organizacija Podgorice.</p><img src="https://podgorica.travel/a.jpg">',
    "https://podgorica.travel/calendar-event/koncert/",
  ).candidate;
  assert.equal(parsed.startsAt, "2026-07-20T19:00:00.000Z");
  assert.equal(parsed.endsAt, "2026-07-20T21:00:00.000Z");
  assert.equal(parsed.rawVenue, "Univerzitetski park");
  assert.equal(parsed.organizer, "Turistička organizacija Podgorice");
  assert.equal(parsed.categoryHint, "concert");
});

test("parses current Tourism named dates and time ranges from event details", () => {
  const parsed = parseTourismEventArticle(
    `<h1 class="entry-title">Izložba u Podgorici</h1>
     <aside class="pe-single-sidebar"><div class="pe-detail-label">Datum</div><div class="pe-detail-value">Petak, 15. maj 2026.</div>
     <div class="pe-detail-label">Vrijeme</div><div class="pe-detail-value">09:00h – 17:00h</div>
     <div class="pe-detail-label">Lokacija</div><div class="pe-detail-value">Muzej savremene umjetnosti</div></aside>`,
    "https://podgorica.travel/calendar-event/izlozba/",
  ).candidate;

  assert.equal(parsed.rawTitle, "Izložba u Podgorici");
  assert.equal(parsed.rawDateText, "15. maj 2026");
  assert.equal(parsed.rawTimeText, "09:00h – 17:00h");
  assert.equal(parsed.startsAt, "2026-05-15T07:00:00.000Z");
  assert.equal(parsed.endsAt, "2026-05-15T15:00:00.000Z");
});
