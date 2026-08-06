import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { parseTivatTourismEventDetail } from "./tivat-tourism-detail-parser.ts";

const fixture = async (name: string) =>
  readFile(new URL(`../__fixtures__/${name}`, import.meta.url), "utf8");

test("takes the place the source marks, verbatim", async () => {
  const detail = parseTivatTourismEventDetail(await fixture("tivat-tourism-detail-sabor.html"));

  // Exactly what the organiser wrote — not split into a hierarchy, not turned into an address.
  assert.equal(detail.venueName, "Trg u Radovićima, Krtoli");
  assert.match(detail.venueName ?? "", /Radović/u);
});

test("a second real page confirms the same location shape", async () => {
  const detail = parseTivatTourismEventDetail(
    await fixture("tivat-tourism-detail-lastovska-festa.html"),
  );

  // Same marker, different page, different position in the block, quotes preserved.
  assert.equal(detail.venueName, "Ispred crkve i Doma kulture “Ilija Marković”");
});

test("keeps the source prose as the description, without the fact block", async () => {
  const detail = parseTivatTourismEventDetail(await fixture("tivat-tourism-detail-sabor.html"));

  assert.equal(
    detail.description,
    "Na 11. Srpskom saboru nastupaju muzički ansambl „Fenički biseri“, narodni guslar Maksim " +
      "Vojvodić, a specijalni gost večeri je Vlado Georgiev. Program vodi Slaviša Ćurović.",
  );
  // The date, time, place and admission lines have their own meaning; repeating them here would
  // be boilerplate, and the date/place are already carried as fields.
  assert.doesNotMatch(detail.description ?? "", /📅|📍|🕘|🎟/u);
  assert.doesNotMatch(detail.description ?? "", /Ulaz slobodan/u);
});

test("a page that states no place yields a description and no venue", async () => {
  const detail = parseTivatTourismEventDetail(
    await fixture("tivat-tourism-detail-no-location.html"),
  );

  // The place is only inside prose ("na glavnom pristaništu u Krašićima"); guessing it out of a
  // sentence would assert something the source never marked as the location.
  assert.equal(detail.venueName, undefined);
  assert.match(detail.description ?? "", /Tradicija se nastavlja/u);
});

test("nothing is invented for a page with no event content", async () => {
  const detail = parseTivatTourismEventDetail(await fixture("tivat-tourism-detail-malformed.html"));

  assert.equal(detail.venueName, undefined);
  assert.equal(detail.description, undefined);
});

test("no address, coordinates or postal structure is ever derived", async () => {
  const detail = parseTivatTourismEventDetail(await fixture("tivat-tourism-detail-sabor.html"));

  assert.deepEqual(Object.keys(detail).sort(), ["description", "venueName"]);
  for (const invented of ["latitude", "longitude", "streetAddress", "postalCode", "addressCountry"])
    assert.equal(invented in detail, false, `${invented} must never be derived`);
});

test("an empty or garbage response degrades quietly", () => {
  assert.deepEqual(parseTivatTourismEventDetail(""), {});
  assert.deepEqual(parseTivatTourismEventDetail("<html><body></body></html>"), {});
});
