import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { getCityEvents } from "../application/get-city-events.ts";
import { kicEventProvider } from "./kic-event-provider.ts";
import { discoverKicArticleUrls, parseKicEventArticle } from "./kic-event-parser.ts";
import { eventProviderRegistry } from "./event-provider-registry.ts";
import { refreshKicEvents } from "./kic-refresh.ts";

const fixturePath = new URL("./__fixtures__/", import.meta.url);
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

async function fixture(name: string) {
  return readFile(new URL(name, fixturePath), "utf8");
}

test("discovers official KIC article URLs only", async () => {
  const urls = discoverKicArticleUrls(await fixture("kic-listing.html"));
  assert.deepEqual(urls, [
    "https://kic.podgorica.me/novosti/101/ljetnji-koncert",
    "https://kic.podgorica.me/novosti/102/pozorisna-predstava",
    "https://kic.podgorica.me/novosti/103/izlozba",
  ]);
});

test("parses KIC concert, theatre, exhibition, price, cancellation, and missing fields", async () => {
  const concert = parseKicEventArticle(
    await fixture("kic-concert.html"),
    "https://kic.podgorica.me/novosti/101/ljetnji-koncert",
  );
  const theatre = parseKicEventArticle(
    await fixture("kic-theatre.html"),
    "https://kic.podgorica.me/novosti/102/pozorisna-predstava",
  );
  const exhibition = parseKicEventArticle(
    await fixture("kic-exhibition-cancelled.html"),
    "https://kic.podgorica.me/novosti/103/izlozba",
  );
  assert.equal(concert.candidate.categoryHint, "concert");
  assert.equal(concert.candidate.isFree, true);
  assert.equal(concert.imageUrl, "https://kic.podgorica.me/media/concert.jpg");
  assert.equal(theatre.candidate.categoryHint, "theatre");
  assert.equal(theatre.candidate.priceAmount, 10);
  assert.equal(theatre.candidate.currency, "EUR");
  assert.equal(theatre.candidate.endsAt, "2026-07-18T20:00:00.000Z");
  assert.equal(exhibition.candidate.categoryHint, "exhibition");
  assert.equal(exhibition.candidate.explicitStatus, "cancelled");
  assert.equal(exhibition.imageUrl, undefined);
  assert.ok(concert.venue?.id === "kic-budo-tomovic");
});

test("collects fixtures atomically through injected KIC HTTP and writes a normalized snapshot", async () => {
  const listing = await fixture("kic-listing.html");
  const concert = await fixture("kic-concert.html");
  const theatre = await fixture("kic-theatre.html");
  const exhibition = await fixture("kic-exhibition-cancelled.html");
  const requested: string[] = [];
  let snapshot: { events: unknown[]; venues: unknown[] } | undefined;
  await refreshKicEvents({
    cachePath: ".runtime/cache/test-kic.json",
    context,
    httpClient: {
      get: async (url) => {
        requested.push(url);
        return url.endsWith("/novosti")
          ? listing
          : url.includes("101")
            ? concert
            : url.includes("102")
              ? theatre
              : exhibition;
      },
    },
    now: () => new Date("2026-07-01T10:00:00.000Z"),
    writeCache: async (value) => {
      snapshot = value;
    },
  });
  assert.equal(requested.length, 4);
  assert.equal(snapshot?.events.length, 3);
  assert.equal(snapshot?.venues.length, 3);
  assert.equal(kicEventProvider.metadata.id, "kic-budo-tomovic");
  assert.equal(kicEventProvider.metadata.refreshIntervalMinutes, 60);
  assert.ok(eventProviderRegistry.some((provider) => provider.metadata.id === "kic-budo-tomovic"));
  const service = await getCityEvents(context, [
    {
      ...kicEventProvider,
      getCachedEvents: async () => ({
        events: [
          {
            category: "concert",
            cityIds: ["podgorica"],
            id: "kic-test",
            language: "me",
            sourceId: "kic-budo-tomovic",
            sourceName: "KIC Budo Tomović",
            sourceReferences: [],
            sourceUrl: "https://kic.podgorica.me/novosti/101/ljetnji-koncert",
            startsAt: "2026-07-17T18:00:00.000Z",
            status: "scheduled",
            tags: [],
            timezone: "Europe/Podgorica",
            title: "Ljetnji koncert",
          },
        ],
        parserWarnings: [],
        state: "fresh",
        venues: [],
      }),
    },
  ]);
  assert.equal(service.events.length, 1);
});
