import assert from "node:assert/strict";
import test from "node:test";
import { refreshTivatTourismEvents } from "./tivat-tourism-refresh.ts";
const context = {
  city: {
    country: "Montenegro",
    id: "tivat" as const,
    isActive: true,
    isMain: false,
    latitude: 42.4353,
    longitude: 18.6961,
    name: "Tivat",
    slug: "tivat",
    timezone: "Europe/Podgorica",
  },
  locale: "me" as const,
  timezone: "Europe/Podgorica",
};
const singleCardHtml = `
  <a href="https://tivat.travel/dogadjaji/koncert-na-trgu/">
    <img data-src="https://tivat.travel/a.jpg" alt="Koncert na trgu">
    <div class="content"><h4>Koncert na trgu</h4><span>25 Jula, 2026 Subota 21:00h</span></div>
  </a>
`;
test("refreshes Tivat Tourism listing through quality and atomic cache injection", async () => {
  let stored: unknown;
  const result = await refreshTivatTourismEvents({
    cachePath: "/tmp/tivat-tourism.json",
    context,
    httpClient: { get: async () => singleCardHtml },
    now: () => new Date("2026-07-01T00:00:00Z"),
    writeCache: async (snapshot) => {
      stored = snapshot;
    },
  });
  assert.equal(result.success, true);
  assert.ok(stored);
  assert.equal(result.snapshot?.events.length, 1);
  assert.equal(result.fetchedPageCount, 1);
});
test("fetches every discovered page and combines candidates across them", async () => {
  const secondPageHtml = `
    <a href="https://tivat.travel/dogadjaji/izlozba-u-galeriji/">
      <img data-src="https://tivat.travel/b.jpg" alt="Izložba u galeriji">
      <div class="content"><h4>Izložba u galeriji</h4><span>1 Augusta, 2026 Subota 18:30h</span></div>
    </a>
  `;
  const firstPageWithPagination = `${singleCardHtml}<a href="https://tivat.travel/dogadjaji/page/2/">2</a>`;
  const requestedUrls: string[] = [];
  const result = await refreshTivatTourismEvents({
    cachePath: "/tmp/tivat-tourism.json",
    context,
    httpClient: {
      get: async (url) => {
        requestedUrls.push(url);
        return url.includes("/page/2/") ? secondPageHtml : firstPageWithPagination;
      },
    },
    now: () => new Date("2026-07-01T00:00:00Z"),
    writeCache: async () => undefined,
  });
  assert.deepEqual(requestedUrls, [
    "https://tivat.travel/dogadjaji/",
    "https://tivat.travel/dogadjaji/page/2/",
  ]);
  assert.equal(result.fetchedPageCount, 2);
  assert.equal(result.snapshot?.events.length, 2);
});
test("retains a usable Tivat Tourism snapshot when every page fetch fails", async () => {
  const previous = {
    events: [
      {
        category: "concert" as const,
        cityId: "tivat" as const,
        cityIds: ["tivat" as const],
        id: "old",
        language: "me" as const,
        sourceId: "tourism-tivat",
        sourceName: "Turistička organizacija Tivat",
        sourceReferences: [],
        sourceUrl: "https://tivat.travel/dogadjaji/old/",
        startsAt: "2026-07-20T19:00:00.000Z",
        status: "scheduled" as const,
        tags: [],
        timezone: "Europe/Podgorica",
        title: "Old",
      },
    ],
    fetchedAt: "2026-07-01T00:00:00.000Z",
    freshnessStatus: "fresh" as const,
    lastSuccessfulRefreshAt: "2026-07-01T00:00:00.000Z",
    parserWarnings: [],
    provider: {
      displayName: "Turistička organizacija Tivat events",
      id: "tourism-tivat",
      sourceUrl: "https://tivat.travel/dogadjaji/",
    },
    schemaVersion: 2 as const,
    venues: [],
  };
  const result = await refreshTivatTourismEvents({
    cachePath: "/tmp/tivat-tourism.json",
    context,
    previousSnapshot: previous,
    httpClient: {
      get: async () => {
        throw new Error("offline");
      },
    },
  });
  assert.equal(result.retainedPreviousSnapshot, true);
  assert.equal(result.snapshot, previous);
  assert.equal(result.success, false);
});
