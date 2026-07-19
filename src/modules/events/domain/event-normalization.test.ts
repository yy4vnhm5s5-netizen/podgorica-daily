import assert from "node:assert/strict";
import test from "node:test";

import { classifyEventMatch, deduplicateEvents } from "./event-deduplication.ts";
import {
  decodeHtmlEntities,
  inferEventCategory,
  normalizeEventCandidate,
} from "./event-normalization.ts";
import type { CityEvent } from "./event.ts";

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

function event(overrides: Partial<CityEvent> = {}): CityEvent {
  return {
    category: "concert",
    cityIds: ["podgorica"],
    id: "event-one",
    language: "me",
    sourceId: "official-organizer",
    sourceName: "Official organizer",
    sourceReferences: [
      {
        sourceId: "official-organizer",
        sourceName: "Official organizer",
        sourceUrl: "https://organizer.example.test/concert",
      },
    ],
    sourceUrl: "https://organizer.example.test/concert",
    startsAt: "2026-07-17T18:00:00.000Z",
    status: "scheduled",
    tags: [],
    timezone: "Europe/Podgorica",
    title: "Koncert – Duo Asja Valčić",
    ...overrides,
  };
}

test("decodes entities and preserves readable title capitalization before validation", () => {
  const normalized = normalizeEventCandidate(
    {
      parserWarnings: [],
      rawAddress: "  Njegoševa&nbsp;1  ",
      rawDescription: "Detalji&nbsp;programa &amp; ulaz &#39;slobodan&#39;.",
      rawTitle: "  🎥 koncert&#8211; duo asja valčić i sebastiana šnajdera 🍿  ",
      rawVenue: "  KIC&nbsp;&quot;Budo Tomović&quot;  ",
      source: {
        sourceId: "official",
        sourceName: "Official",
        sourceUrl: "https://official.example.test/event",
      },
      startDate: "2026-07-20",
      timezone: context.timezone,
    },
    context,
  ).event;

  assert.equal(normalized?.title, "Koncert – duo Asja Valčić i Sebastiana Šnajdera");
  assert.equal(normalized?.description, "Detalji programa & ulaz 'slobodan'.");
  assert.equal(normalized?.venueName, 'KIC "Budo Tomović"');
  assert.equal(normalized?.address, "Njegoševa 1");
  assert.equal(normalized?.category, "concert");
  assert.equal(decodeHtmlEntities("&amp;#8211;"), "&#8211;");
});

test("infers a category only when a provider has no specific category", () => {
  assert.equal(inferEventCategory("Dječji filmski kamp"), "kids");
  assert.equal(inferEventCategory("Izložba savremene umjetnosti"), "exhibition");
  assert.equal(inferEventCategory("Koncert kamerne muzike"), "concert");
  assert.equal(inferEventCategory("Predstava za odrasle"), "theatre");
  assert.equal(inferEventCategory("Predavanje o gradu"), "education");

  const providerCategory = normalizeEventCandidate(
    {
      categoryHint: "theatre",
      parserWarnings: [],
      rawTitle: "Koncert u teatru",
      source: {
        sourceId: "official",
        sourceName: "Official",
        sourceUrl: "https://official.example.test/theatre",
      },
      startDate: "2026-07-20",
      timezone: context.timezone,
    },
    context,
  ).event;
  assert.equal(providerCategory?.category, "theatre");

  const childrenCategory = normalizeEventCandidate(
    {
      categoryHint: "exhibition",
      parserWarnings: [],
      rawDescription: "Filmski program za najmlađe učesnike.",
      rawTitle: "Dječji filmski kamp",
      source: {
        sourceId: "official",
        sourceName: "Official",
        sourceUrl: "https://official.example.test/kids",
      },
      startDate: "2026-07-20",
      timezone: context.timezone,
    },
    context,
  ).event;
  assert.equal(childrenCategory?.category, "kids");
});

test("merges fuzzy cross-provider duplicates within thirty minutes and retains provenance", () => {
  const official = event({
    description: "Kratak opis.",
    imageUrl: "https://organizer.example.test/concert.jpg",
    title: "Koncert Asje Valčić i Sebastiana Šnajdera",
    venueName: "Njegošev park",
  });
  const government = event({
    description: "Detaljan opis koncerta sa kompletnim programom i informacijama za publiku.",
    id: "government-event",
    imageUrl: "https://government.example.test/concert.jpg",
    sourceId: "government",
    sourceName: "Glavni grad",
    sourceReferences: [
      {
        sourceId: "government",
        sourceName: "Glavni grad",
        sourceUrl: "https://government.example.test/concert",
      },
    ],
    sourceUrl: "https://government.example.test/concert",
    startsAt: "2026-07-17T18:20:00.000Z",
    title: "Koncert – Duo Asja Valčić i Sebastian Schneider, 20. jula u Njegoševom parku",
    venueName: "Paviljon u Njegoševom parku",
  });

  assert.equal(classifyEventMatch(official, government), "strong");
  const merged = deduplicateEvents([official, government]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0]?.description, government.description);
  assert.equal(merged[0]?.imageUrl, government.imageUrl);
  assert.deepEqual(
    merged[0]?.sourceReferences.map(({ sourceUrl }) => sourceUrl),
    ["https://organizer.example.test/concert", "https://government.example.test/concert"],
  );
});

test("does not merge unrelated events that only share a generic category word", () => {
  const first = event({ title: "Koncert Marka Nikolića", venueName: "KIC Budo Tomović" });
  const second = event({
    id: "other-event",
    sourceId: "government",
    sourceName: "Glavni grad",
    sourceReferences: [
      {
        sourceId: "government",
        sourceName: "Glavni grad",
        sourceUrl: "https://government.example.test/other-concert",
      },
    ],
    sourceUrl: "https://government.example.test/other-concert",
    startsAt: "2026-07-17T18:20:00.000Z",
    title: "Koncert Milice Jovanović",
    venueName: "KIC Budo Tomović",
  });

  assert.equal(classifyEventMatch(first, second), "distinct");
  assert.equal(deduplicateEvents([first, second]).length, 2);
});
