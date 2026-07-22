import assert from "node:assert/strict";
import test from "node:test";

import { getCityEvents } from "../application/get-city-events.ts";
import { glavniGradEventProvider } from "./glavni-grad-event-provider.ts";
import {
  discoverGlavniGradEventUrls,
  parseGlavniGradEventArticle,
} from "./glavni-grad-event-parser.ts";
import { eventProviderRegistry } from "./event-provider-registry.ts";
import { refreshGlavniGradEvents } from "./glavni-grad-refresh.ts";

const context = {
  city: {
    country: "Montenegro",
    id: "podgorica" as const,
    isActive: true,
    isMain: true,
    latitude: 42.441,
    longitude: 19.263,
    name: "Podgorica",
    slug: "podgorica",
    timezone: "Europe/Podgorica",
  },
  locale: "me" as const,
  timezone: "Europe/Podgorica",
};
const listingUrl = "https://podgorica.me/category/aktuelni-dogadjaji/";
const eventUrl = "https://podgorica.me/koncert-u-parku/";
const listing =
  '<article><a href="/koncert-u-parku/">Koncert</a></article><a href="https://evil.example/no">Ignore</a>';
const detail =
  '<meta property="og:image" content="https://podgorica.me/koncert.jpg"><h1>Koncert u parku</h1><article>Koncert će biti održan 20.07.2026. u 21 čas u parku Univerzitetskom. Ulaz je slobodan.</article>';

test("parses official Glavni Grad listing and event details deterministically", () => {
  assert.deepEqual(discoverGlavniGradEventUrls(listing), [eventUrl]);
  const parsed = parseGlavniGradEventArticle(detail, eventUrl);
  assert.equal(parsed.candidate.categoryHint, "concert");
  assert.equal(parsed.candidate.startsAt, "2026-07-20T19:00:00.000Z");
  assert.equal(parsed.candidate.imageUrl, "https://podgorica.me/koncert.jpg");
  assert.equal(parsed.candidate.rawVenue, "u parku Univerzitetskom");
  assert.deepEqual(
    parseGlavniGradEventArticle("<h1>Nepotpuno</h1>", eventUrl).candidate.parserWarnings,
    ["Glavni Grad article date was unavailable."],
  );
});

test("keeps a named Montenegrin event date through discovery, normalization, and cache refresh", async () => {
  const disclosureUrl = "https://podgorica.me/film-dan-razotkrivanja-disclosure-day-2026/";
  const navigation = Array.from(
    { length: 24 },
    (_, index) => `<a href="/navigation-${index}/">Navigation</a>`,
  ).join("");
  const disclosureListing = `${navigation}<article><a href="/film-dan-razotkrivanja-disclosure-day-2026/">Film</a></article>`;
  const disclosureDetail = `<article><time datetime="2026-07-06T12:00:00+02:00">6. jul 2026.</time><h1>Film „Dan razotkrivanja/Disclosure Day” (2026)</h1><p>Projekcija će biti organizovana u utorak, 21. jula, u digitalizovanoj bioskopskoj sali KIC-a, u 20 sati.</p></article>`;
  const requestedUrls: string[] = [];

  assert.deepEqual(discoverGlavniGradEventUrls(disclosureListing), [disclosureUrl]);
  const parsed = parseGlavniGradEventArticle(disclosureDetail, disclosureUrl);
  assert.equal(parsed.candidate.startsAt, "2026-07-21T18:00:00.000Z");
  assert.equal(parsed.candidate.startDate, undefined);
  assert.equal(parsed.candidate.rawVenue, "digitalizovanoj bioskopskoj sali KIC-a");

  let snapshot: Awaited<ReturnType<typeof refreshGlavniGradEvents>> | undefined;
  await refreshGlavniGradEvents({
    cachePath: "/tmp/glavni-grad-disclosure-test.json",
    context,
    httpClient: {
      get: async (url) => {
        requestedUrls.push(url);
        return url === listingUrl ? disclosureListing : disclosureDetail;
      },
    },
    now: () => new Date("2026-07-06T10:00:00.000Z"),
    writeCache: async (next) => {
      snapshot = next;
    },
  });

  assert.deepEqual(requestedUrls, [listingUrl, disclosureUrl]);
  assert.equal(snapshot?.events.length, 1);
  assert.equal(snapshot?.events[0]?.startsAt, "2026-07-21T18:00:00.000Z");
  assert.equal(snapshot?.qualityDiagnostics?.rejectedCount, 0);
});

test("parses the current Elementor title and content structure", () => {
  const currentStructure = `
    <div class="elementor-widget-theme-post-title"><h3 class="elementor-heading-title">Film dana</h3></div>
    <time>July 6, 2026</time>
    <div class="elementor-widget-theme-post-content"><div class="elementor-widget-container">
      <p>Projekcija će biti organizovana u utorak, 21. jula, u digitalizovanoj bioskopskoj sali KIC-a, u 20 sati.</p>
    </div></div>`;

  const parsed = parseGlavniGradEventArticle(currentStructure, eventUrl).candidate;
  assert.equal(parsed.rawTitle, "Film dana");
  assert.equal(parsed.rawTimeText, "u 20 sati");
  assert.equal(parsed.startsAt, "2026-07-21T18:00:00.000Z");
  assert.equal(parsed.rawVenue, "digitalizovanoj bioskopskoj sali KIC-a");
});

test("registers, quality-normalizes, caches, and exposes Glavni Grad events through the generic application service", async () => {
  let snapshot: Awaited<ReturnType<typeof refreshGlavniGradEvents>> | undefined;
  await refreshGlavniGradEvents({
    cachePath: "/tmp/glavni-grad-test.json",
    context,
    httpClient: { get: async (url) => (url === listingUrl ? listing : detail) },
    now: () => new Date("2026-07-01T10:00:00.000Z"),
    writeCache: async (next) => {
      snapshot = next;
    },
  });
  assert.equal(snapshot?.events.length, 1);
  assert.equal(snapshot?.qualityDiagnostics?.finalEventCount, 1);
  assert.ok(
    eventProviderRegistry.some((provider) => provider.metadata.id === "glavni-grad-podgorica"),
  );
  assert.equal(glavniGradEventProvider.metadata.officialSource, listingUrl);
  const result = await getCityEvents(context, [
    {
      ...glavniGradEventProvider,
      getCachedEvents: async () => ({
        events: snapshot?.events ?? [],
        parserWarnings: [],
        qualityDiagnostics: snapshot?.qualityDiagnostics,
        state: "fresh",
        venues: [],
      }),
    },
  ]);
  assert.equal(result.events.length, 1);
});
