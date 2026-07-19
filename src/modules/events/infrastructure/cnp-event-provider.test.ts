import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { cnpEventProvider } from "./cnp-event-provider.ts";
import {
  discoverCnpEventUrls,
  parseCnpEventArticle,
  parseCnpRepertoire,
} from "./cnp-event-parser.ts";
import { normalizeEventCandidate } from "../domain/event-normalization.ts";

const fixtures = new URL("./__fixtures__/", import.meta.url);
test("discovers same-host CNP URLs and parses theatre details", async () => {
  const listing = await readFile(new URL("cnp-listing.html", fixtures), "utf8");
  assert.deepEqual(discoverCnpEventUrls(listing), [
    "https://cnp.me/hamlet/",
    "https://cnp.me/hamlet-21-july/",
    "https://cnp.me/romeo/",
  ]);
  const parsed = parseCnpEventArticle(
    await readFile(new URL("cnp-theatre.html", fixtures), "utf8"),
    "https://cnp.me/hamlet/",
  );
  assert.equal(parsed.candidate.categoryHint, "theatre");
  assert.equal(parsed.candidate.rawTitle, "Hamlet");
  assert.match(parsed.candidate.rawDescription ?? "", /Predstava Hamlet/);
  assert.equal(parsed.candidate.rawDateText, "20.07.2026");
  assert.equal(parsed.candidate.startsAt, "2026-07-20T18:00:00.000Z");
  assert.equal(parsed.candidate.priceAmount, 10);
  assert.equal(parsed.candidate.currency, "EUR");
  assert.equal(parsed.candidate.endsAt, undefined);
  assert.equal(parsed.venue?.id, "cnp");
  assert.equal(cnpEventProvider.metadata.id, "cnp");
});

test("parses the current CNP table repertoire without treating ticket links as event pages", async () => {
  const candidates = parseCnpRepertoire(
    await readFile(new URL("cnp-repertoire-table.html", fixtures), "utf8"),
  );

  assert.equal(candidates.length, 2);
  assert.equal(candidates[0]?.rawTitle, "ROMEO I JULIJA");
  assert.equal(candidates[0]?.rawDateText, "20. jul 2026");
  assert.equal(candidates[0]?.rawTimeText, "u 20h");
  assert.equal(candidates[0]?.startsAt, "2026-07-20T18:00:00.000Z");
  assert.equal(candidates[0]?.rawVenue, "Velika scena");
  assert.equal(candidates[1]?.startsAt, "2026-07-21T07:30:00.000Z");
  assert.equal(candidates[1]?.source.sourceUrl, "https://cnp.me/repertoar/");
});

test("preserves date-only, free, and postponed CNP event details", async () => {
  const parsed = parseCnpEventArticle(
    await readFile(new URL("cnp-date-only-free-postponed.html", fixtures), "utf8"),
    "https://cnp.me/hamlet-21-july/",
  );

  assert.equal(parsed.candidate.startDate, "2026-07-21");
  assert.equal(parsed.candidate.startsAt, undefined);
  assert.equal(parsed.candidate.imageUrl, undefined);
  assert.equal(parsed.candidate.isFree, true);
  assert.equal(parsed.candidate.priceAmount, undefined);
  assert.equal(parsed.candidate.explicitStatus, "postponed");
  assert.ok(parsed.candidate.parserWarnings.includes("CNP article start time was unavailable."));
  assert.equal(parsed.venue?.id, "cnp");
});

test("extracts non-theatre category, price, image, and unknown venue without guessing", async () => {
  const parsed = parseCnpEventArticle(
    await readFile(new URL("cnp-concert-unknown-venue.html", fixtures), "utf8"),
    "https://cnp.me/vece-muzike/",
  );

  assert.equal(parsed.candidate.categoryHint, "concert");
  assert.equal(parsed.candidate.startsAt, "2026-07-22T19:30:00.000Z");
  assert.equal(parsed.candidate.priceAmount, 12.5);
  assert.equal(parsed.candidate.currency, "EUR");
  assert.equal(parsed.candidate.imageUrl, "https://cnp.me/images/vece-muzike.jpg");
  assert.equal(parsed.candidate.rawVenue, "u prostoru Galerije savremene umjetnosti");
  assert.equal(parsed.venue, undefined);
});

test("warns for incomplete details without preventing valid event normalization", async () => {
  const incomplete = parseCnpEventArticle(
    await readFile(new URL("cnp-cancelled-incomplete.html", fixtures), "utf8"),
    "https://cnp.me/gostovanje/",
  );
  assert.equal(incomplete.candidate.explicitStatus, "cancelled");
  assert.equal(incomplete.candidate.categoryHint, "other");
  assert.equal(incomplete.candidate.imageUrl, undefined);
  assert.ok(incomplete.candidate.parserWarnings.includes("CNP article date was unavailable."));

  const first = parseCnpEventArticle(
    await readFile(new URL("cnp-theatre.html", fixtures), "utf8"),
    "https://cnp.me/hamlet/",
  ).candidate;
  const second = parseCnpEventArticle(
    await readFile(new URL("cnp-date-only-free-postponed.html", fixtures), "utf8"),
    "https://cnp.me/hamlet-21-july/",
  ).candidate;
  const sameIdentityWithChangedOptionalFields = {
    ...first,
    imageUrl: undefined,
    parserWarnings: ["An optional field was unavailable."],
    rawDescription: "A revised description.",
  };
  const context = {
    city: {
      country: "Montenegro",
      displayName: "Podgorica",
      enabled: true,
      id: "podgorica" as const,
      latitude: 42.441,
      longitude: 19.263,
      slug: "podgorica",
      timezone: "Europe/Podgorica",
    },
    locale: "me" as const,
    timezone: "Europe/Podgorica",
  };
  const normalizedFirst = normalizeEventCandidate(first, context).event;
  const normalizedSame = normalizeEventCandidate(
    sameIdentityWithChangedOptionalFields,
    context,
  ).event;
  const normalizedSecond = normalizeEventCandidate(second, context).event;
  const normalizedDifferentTime = normalizeEventCandidate(
    { ...first, startsAt: "2026-07-20T19:00:00.000Z" },
    context,
  ).event;

  assert.ok(normalizedFirst);
  assert.ok(normalizedSame);
  assert.ok(normalizedSecond);
  assert.ok(normalizedDifferentTime);
  assert.equal(normalizedFirst.id, normalizedSame.id);
  assert.notEqual(normalizedFirst.id, normalizedSecond.id);
  assert.notEqual(normalizedFirst.id, normalizedDifferentTime.id);
});
