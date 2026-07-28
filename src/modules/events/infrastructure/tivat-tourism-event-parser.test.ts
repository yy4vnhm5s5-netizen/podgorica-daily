import assert from "node:assert/strict";
import test from "node:test";
import {
  extractTivatTourismPageCount,
  getTivatTourismPageUrl,
  parseTivatTourismEventCards,
  tivatTourismCalendarUrl,
} from "./tivat-tourism-event-parser.ts";

test("extracts candidates from listing cards, dedupes by URL, ignores pagination links, and accepts both 'Jula' and 'Augusta' month spellings", () => {
  const html = `
    <a href="https://tivat.travel/dogadjaji/koncert-na-trgu/">
      <img data-src="https://tivat.travel/wp-content/uploads/koncert.jpg" alt="Koncert na trgu">
      <div class="content">
        <h4>Koncert na trgu</h4>
        <span>25 Jula, 2026 Subota 21:00h</span>
      </div>
    </a>
    <a href="https://tivat.travel/dogadjaji/koncert-na-trgu/">
      <img data-src="https://tivat.travel/wp-content/uploads/koncert-dup.jpg" alt="Duplikat">
      <div class="content">
        <h4>Duplikat unosa</h4>
        <span>25 Jula, 2026 Subota 21:00h</span>
      </div>
    </a>
    <a href="https://tivat.travel/dogadjaji/izlozba-u-galeriji/">
      <img data-src="https://tivat.travel/wp-content/uploads/izlozba.jpg" alt="Izložba u galeriji">
      <div class="content">
        <h4>Izložba u galeriji</h4>
        <span>1 Augusta, 2026 Subota 18:30h</span>
      </div>
    </a>
    <a href="https://tivat.travel/dogadjaji/page/2/">Sljedeća stranica</a>
  `;

  const { candidates } = parseTivatTourismEventCards(html);
  assert.equal(candidates.length, 2);

  const [concert, exhibition] = candidates;
  assert.equal(concert.rawTitle, "Koncert na trgu");
  assert.equal(concert.imageUrl, "https://tivat.travel/wp-content/uploads/koncert.jpg");
  assert.equal(concert.source.sourceId, "tourism-tivat");
  assert.equal(concert.source.sourceName, "Turistička organizacija Tivat");
  assert.equal(concert.source.sourceUrl, "https://tivat.travel/dogadjaji/koncert-na-trgu/");
  assert.equal(concert.language, "me");
  assert.equal(concert.timezone, "Europe/Podgorica");
  assert.equal(concert.startsAt, "2026-07-25T19:00:00.000Z");
  assert.deepEqual(concert.parserWarnings, []);

  assert.equal(exhibition.rawTitle, "Izložba u galeriji");
  assert.equal(
    exhibition.source.sourceUrl,
    "https://tivat.travel/dogadjaji/izlozba-u-galeriji/",
  );
  assert.equal(exhibition.startsAt, "2026-08-01T16:30:00.000Z");
});

test("treats an exact 00:00h as no time given, and tolerates unparseable or invalid dates without inventing one", () => {
  const card = (dateText: string) => `
    <a href="https://tivat.travel/dogadjaji/dogadjaj/">
      <img data-src="https://tivat.travel/wp-content/uploads/a.jpg" alt="Događaj">
      <div class="content">
        <h4>Događaj</h4>
        <span>${dateText}</span>
      </div>
    </a>
  `;

  const midnight = parseTivatTourismEventCards(card("10 Maja, 2026 Nedjelja 00:00h")).candidates[0];
  assert.equal(midnight.startsAt, undefined);
  assert.equal(midnight.startDate, "2026-05-10");
  assert.deepEqual(midnight.parserWarnings, []);

  const garbled = parseTivatTourismEventCards(card("Uskoro")).candidates[0];
  assert.equal(garbled.startsAt, undefined);
  assert.equal(garbled.startDate, undefined);
  assert.deepEqual(garbled.parserWarnings, ["Tivat Tourism event date was unavailable."]);

  const invalidCalendarDate = parseTivatTourismEventCards(
    card("31 Februara, 2026 Nedjelja 20:00h"),
  ).candidates[0];
  assert.equal(invalidCalendarDate.startsAt, undefined);
  assert.equal(invalidCalendarDate.startDate, undefined);
  assert.deepEqual(invalidCalendarDate.parserWarnings, [
    "Tivat Tourism event date was unavailable.",
  ]);
});

test("derives and caps the listing page count from pagination links, and builds matching page URLs", () => {
  assert.equal(extractTivatTourismPageCount("<html>no pagination here</html>"), 1);
  assert.equal(
    extractTivatTourismPageCount(
      '<a href="/dogadjaji/page/2/">2</a><a href="/dogadjaji/page/3/">3</a>',
    ),
    3,
  );
  assert.equal(
    extractTivatTourismPageCount('<a href="/dogadjaji/page/15/">15</a>'),
    10,
  );

  assert.equal(getTivatTourismPageUrl(1), tivatTourismCalendarUrl);
  assert.equal(getTivatTourismPageUrl(3), `${tivatTourismCalendarUrl}page/3/`);
});
