import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  createPlatformCityCardData,
  createPlatformHomepageStructuredData,
  formatCount,
  getPlatformHomepageMetadata,
} from "./platform-homepage-data.ts";
import type { CityEventsReadModel } from "@/modules/events/application/get-city-events";
import { getEmptyCityEventsReadModel } from "@/modules/events/application/get-city-events";
import type { CityEvent } from "@/modules/events/domain/event";
import type { GoingOutEvent } from "@/modules/going-out/domain/going-out-event";
import { createCityContext, getActiveCities, getCity } from "@/shared/config/cities";

test("platform homepage uses the shared snapshot-backed dashboard loader rather than Open-Meteo", async () => {
  const source = await readFile(new URL("./platform-homepage-data.ts", import.meta.url), "utf8");

  assert.match(source, /import \{ loadCityDashboardData \} from "@\/app\/city-dashboard-data";/u);
  assert.match(source, /await loadCityDashboardData\(/u);
  assert.doesNotMatch(source, /open-meteo|fetchOpenMeteoCurrentWeather|fetch\(/iu);
});

test("derives generic city cards from every active registry city", () => {
  const cards = getActiveCities().map((city) =>
    createPlatformCityCardData(createCityContext(city.id), null),
  );

  assert.deepEqual(
    cards.map((card) => card.city.id),
    ["bar", "budva", "kotor", "podgorica", "tivat"],
  );
  const bar = cards.find((card) => card.city.id === "bar");
  assert.ok(bar);
  assert.deepEqual(
    bar.shortcuts.map((shortcut) => shortcut.label),
    ["Izlasci", "Plaže", "Struja"],
  );
  assert.deepEqual(
    bar.highlights.map((highlight) => highlight.key),
    ["weather", "going-out", "sea-water-quality"],
  );
  const budva = cards.find((card) => card.city.id === "budva");
  assert.ok(budva);
  assert.deepEqual(
    budva.shortcuts.map((shortcut) => shortcut.label),
    ["Izlasci", "Plaže", "Struja"],
  );
  assert.deepEqual(
    budva.highlights.map((highlight) => highlight.key),
    ["weather", "going-out", "sea-water-quality"],
  );
  assert.deepEqual(
    cards.find((card) => card.city.id === "podgorica")?.shortcuts.map((shortcut) => shortcut.label),
    ["Događaji", "Izlasci", "Letovi", "Struja"],
  );
  assert.deepEqual(
    cards
      .find((card) => card.city.id === "podgorica")
      ?.highlights.map((highlight) => highlight.key),
    ["weather", "events", "going-out", "movies"],
  );
  const tivat = cards.find((card) => card.city.id === "tivat");
  assert.ok(tivat);
  assert.deepEqual(
    tivat.shortcuts.map((shortcut) => shortcut.label),
    ["Događaji", "Izlasci", "Plaže", "Struja"],
  );
  assert.deepEqual(
    tivat.highlights.map((highlight) => highlight.key),
    ["weather", "events", "going-out", "sea-water-quality"],
  );
  const kotor = cards.find((card) => card.city.id === "kotor");
  assert.ok(kotor);
  assert.deepEqual(
    kotor.shortcuts.map((shortcut) => shortcut.label),
    ["Izlasci", "Plaže", "Struja"],
  );
  assert.deepEqual(
    kotor.highlights.map((highlight) => highlight.key),
    ["weather", "going-out", "sea-water-quality"],
  );
  assert.equal(getCity("budva")?.isActive, true);
  assert.equal(getCity("tivat")?.isActive, true);
  assert.equal(getCity("kotor")?.isActive, true);
});

test("Tivat's homepage card includes a Događaji shortcut pointing to /tivat/dogadjaji", () => {
  const tivat = createPlatformCityCardData(createCityContext("tivat"), null);
  const eventsShortcut = tivat.shortcuts.find((shortcut) => shortcut.key === "events");

  assert.ok(eventsShortcut);
  assert.equal(eventsShortcut.label, "Događaji");
  assert.equal(eventsShortcut.href, "/tivat/dogadjaji");
});

test("a city without the events capability does not receive the Događaji shortcut", () => {
  const budva = createPlatformCityCardData(createCityContext("budva"), null);

  assert.equal(
    budva.shortcuts.some((shortcut) => shortcut.key === "events"),
    false,
  );
});

test("creates platform metadata and structured data only from public city cards", () => {
  const cities = getActiveCities();
  const structuredData = createPlatformHomepageStructuredData([
    ...cities.map((city) => createPlatformCityCardData(createCityContext(city.id), null)),
  ]);
  const metadata = getPlatformHomepageMetadata();
  const graph = structuredData["@graph"];

  assert.equal(metadata.alternates?.canonical, "/");
  assert.equal(metadata.openGraph?.url, "/");
  assert.match(JSON.stringify(metadata.twitter), /summary_large_image/u);
  assert.equal(graph[0]?.["@type"], "WebSite");
  assert.equal(graph[1]?.["@type"], "ItemList");
  assert.deepEqual(graph[1]?.itemListElement, [
    {
      "@type": "ListItem",
      name: "Bar",
      position: 1,
      url: "https://gradom.me/bar",
    },
    {
      "@type": "ListItem",
      name: "Budva",
      position: 2,
      url: "https://gradom.me/budva",
    },
    {
      "@type": "ListItem",
      name: "Kotor",
      position: 3,
      url: "https://gradom.me/kotor",
    },
    {
      "@type": "ListItem",
      name: "Podgorica",
      position: 4,
      url: "https://gradom.me/podgorica",
    },
    {
      "@type": "ListItem",
      name: "Tivat",
      position: 5,
      url: "https://gradom.me/tivat",
    },
  ]);
  assert.equal(JSON.stringify(structuredData).includes("bar"), true);
  assert.equal(JSON.stringify(structuredData).includes("budva"), true);
  assert.equal(JSON.stringify(structuredData).includes("kotor"), true);
});

test("uses the same available Going Out result as the city page and does not turn unavailable data into zero", () => {
  const context = createCityContext("budva");
  const event: GoingOutEvent = {
    city: "budva",
    id: "budva-going-out",
    sourceName: "MonteGigs",
    sourceUrl: "https://staging.montegigs.me/me/events/budva/1-20991231-party",
    startDate: "2099-12-31",
    title: "Budva party",
  };
  const available = createPlatformCityCardData(context, {
    capabilities: {
      cityAlerts: true,
      events: false,
      flights: false,
      goingOut: true,
      railway: false,
      seaWaterQuality: true,
      weather: true,
    },
    events: getEmptyCityEventsReadModel(),
    flights: null,
    goingOut: { events: [event], state: "fresh" },
    railway: null,
    seaWaterQuality: null,
    weather: null,
  });
  const unavailable = createPlatformCityCardData(context, null);
  const staleWithoutEvents = createPlatformCityCardData(context, {
    capabilities: {
      cityAlerts: true,
      events: false,
      flights: false,
      goingOut: true,
      railway: false,
      seaWaterQuality: true,
      weather: true,
    },
    events: getEmptyCityEventsReadModel(),
    flights: null,
    goingOut: { events: [], state: "stale" },
    railway: null,
    seaWaterQuality: null,
    weather: null,
  });

  assert.deepEqual(
    available.highlights.find(({ key }) => key === "going-out"),
    {
      accessibilityLabel: "1 izlazak u Budva",
      href: "/budva/izlasci",
      key: "going-out",
      label: "izlazak",
      priority: 3,
      state: "available",
      value: "1",
      visual: "music",
    },
  );
  assert.equal(unavailable.highlights.find(({ key }) => key === "going-out")?.state, "unavailable");
  assert.equal(
    unavailable.highlights.find(({ key }) => key === "going-out")?.value,
    "Podaci nijesu dostupni",
  );
  assert.equal(
    staleWithoutEvents.highlights.find(({ key }) => key === "going-out")?.value,
    "Podaci nijesu dostupni",
  );
});

test("derives Podgorica event and movie totals from the same displayable read models as their pages", () => {
  const context = createCityContext("podgorica");
  const event: CityEvent = {
    category: "concert",
    cityId: "podgorica",
    cityIds: ["podgorica"],
    id: "future-event",
    language: "me",
    sourceId: "kic",
    sourceName: "KIC",
    sourceReferences: [],
    sourceUrl: "https://example.test/future-event",
    startDate: "2099-12-31",
    status: "scheduled",
    tags: [],
    timezone: "Europe/Podgorica",
    title: "Budući događaj",
  };
  const movieEvents: CityEvent[] = ["Movie One", "Movie Two"].map((title, index) => ({
    category: "movie",
    cityId: "podgorica",
    cityIds: ["podgorica"],
    id: `cineplexx-movie-${index + 1}`,
    language: "me",
    sourceId: "cineplexx-podgorica",
    sourceName: "Cineplexx",
    sourceReferences: [],
    sourceUrl: `https://example.test/cineplexx/movie-${index + 1}`,
    startsAt: "2099-12-31T18:00:00.000Z",
    status: "scheduled",
    tags: [],
    timezone: "Europe/Podgorica",
    title,
  }));
  // Only `id`/`state` are read by the code under test; the full EventProviderStatusReadModel
  // shape isn't needed for this fixture.
  const cineplexxProvider = {
    id: "cineplexx-podgorica",
    state: "fresh",
  } as CityEventsReadModel["providers"][number];

  const card = createPlatformCityCardData(context, {
    capabilities: {
      cityAlerts: true,
      events: true,
      flights: true,
      goingOut: true,
      railway: true,
      seaWaterQuality: false,
      weather: true,
    },
    events: {
      ...getEmptyCityEventsReadModel(),
      events: [event, ...movieEvents],
      providers: [cineplexxProvider],
    },
    flights: null,
    goingOut: { events: [], state: "fresh" },
    railway: null,
    seaWaterQuality: null,
    weather: null,
  });

  assert.equal(card.highlights.find(({ key }) => key === "events")?.value, "1");
  assert.equal(card.highlights.find(({ key }) => key === "events")?.label, "događaj");
  assert.equal(card.highlights.find(({ key }) => key === "movies")?.value, "2");
  assert.equal(card.highlights.find(({ key }) => key === "movies")?.label, "filma");
});

// Regression test for the reported /podgorica-vs-/podgorica/filmovi mismatch: the homepage
// "Filmovi" highlight used to count every cached Cineplexx screening record's distinct tag, which
// inflated far beyond the /filmovi page's own (differently, more narrowly derived) count. Many
// screenings of the same 2 movies spread across several days must still show "2 filma".
test("counts many screenings of the same movies across several days as their unique movie count, not a screening count", () => {
  const context = createCityContext("podgorica");
  const movieTitles = ["Movie One", "Movie Two"];
  const cinemaEvents: CityEvent[] = movieTitles.flatMap((title, movieIndex) =>
    ["2099-12-30", "2099-12-31", "2100-01-01"].map((date, dayIndex) => ({
      category: "movie" as const,
      cityId: "podgorica" as const,
      cityIds: ["podgorica" as const],
      id: `cineplexx-movie-${movieIndex}-${dayIndex}`,
      language: "me" as const,
      sourceId: "cineplexx-podgorica",
      sourceName: "Cineplexx",
      sourceReferences: [],
      sourceUrl: `https://example.test/cineplexx/${movieIndex}-${dayIndex}`,
      startsAt: `${date}T18:00:00.000Z`,
      status: "scheduled" as const,
      tags: [`movie:https://example.test/film/movie-${movieIndex}`],
      timezone: "Europe/Podgorica",
      title,
    })),
  );
  // Only `id`/`state` are read by the code under test; the full EventProviderStatusReadModel
  // shape isn't needed for this fixture.
  const cineplexxProvider = {
    id: "cineplexx-podgorica",
    state: "fresh",
  } as CityEventsReadModel["providers"][number];

  const card = createPlatformCityCardData(context, {
    capabilities: {
      cityAlerts: true,
      events: true,
      flights: true,
      goingOut: true,
      railway: true,
      seaWaterQuality: false,
      weather: true,
    },
    events: {
      ...getEmptyCityEventsReadModel(),
      events: cinemaEvents,
      providers: [cineplexxProvider],
    },
    flights: null,
    goingOut: { events: [], state: "fresh" },
    railway: null,
    seaWaterQuality: null,
    weather: null,
  });

  assert.equal(cinemaEvents.length, 6);
  assert.equal(card.highlights.find(({ key }) => key === "movies")?.value, "2");
  assert.equal(card.highlights.find(({ key }) => key === "movies")?.label, "filma");
});

test("shows Tivat's own beach count in the sea water quality highlight, not Budva's", () => {
  const context = createCityContext("tivat");
  const card = createPlatformCityCardData(context, {
    capabilities: {
      cityAlerts: false,
      events: true,
      flights: false,
      goingOut: true,
      railway: false,
      seaWaterQuality: true,
      weather: true,
    },
    events: getEmptyCityEventsReadModel(),
    flights: null,
    goingOut: { events: [], state: "fresh" },
    railway: null,
    seaWaterQuality: {
      state: "fresh",
      summary: {
        gradeCounts: { excellent: 7, good: 1, poor: 0, satisfactory: 2 },
        locations: [],
        municipality: "tivat",
        totalLocations: 10,
      },
    },
    weather: null,
  });

  assert.deepEqual(
    card.highlights.find(({ key }) => key === "sea-water-quality"),
    {
      accessibilityLabel: "10 kupališta u Tivat",
      href: "/tivat/plaze",
      key: "sea-water-quality",
      label: "kupališta",
      priority: 5,
      state: "available",
      value: "10",
      visual: "waves",
    },
  );
});

test("never shows a movies highlight for Tivat, even if Cineplexx-shaped events appear in its read model", () => {
  const context = createCityContext("tivat");
  const tivatEvent: CityEvent = {
    category: "concert",
    cityId: "tivat",
    cityIds: ["tivat"],
    id: "tivat-koncert",
    language: "me",
    sourceId: "tourism-tivat",
    sourceName: "Turistička organizacija Tivat",
    sourceReferences: [],
    sourceUrl: "https://tivat.travel/dogadjaji/koncert/",
    startDate: "2099-12-31",
    status: "scheduled",
    tags: [],
    timezone: "Europe/Podgorica",
    title: "Tivatski koncert",
  };
  const unexpectedMovieEvent: CityEvent = {
    category: "movie",
    cityId: "tivat",
    cityIds: ["tivat"],
    id: "unexpected-movie",
    language: "me",
    sourceId: "cineplexx-podgorica",
    sourceName: "Cineplexx",
    sourceReferences: [],
    sourceUrl: "https://example.test/cineplexx/unexpected-movie",
    startsAt: "2099-12-31T18:00:00.000Z",
    status: "scheduled",
    tags: [],
    timezone: "Europe/Podgorica",
    title: "Unexpected Movie",
  };
  // Only `id`/`state` are read by the code under test; the full EventProviderStatusReadModel
  // shape isn't needed for this fixture.
  const cineplexxProvider = {
    id: "cineplexx-podgorica",
    state: "fresh",
  } as CityEventsReadModel["providers"][number];

  const card = createPlatformCityCardData(context, {
    capabilities: {
      cityAlerts: false,
      events: true,
      flights: false,
      goingOut: true,
      railway: false,
      seaWaterQuality: true,
      weather: true,
    },
    events: {
      ...getEmptyCityEventsReadModel(),
      events: [tivatEvent, unexpectedMovieEvent],
      providers: [cineplexxProvider],
    },
    flights: null,
    goingOut: { events: [], state: "fresh" },
    railway: null,
    seaWaterQuality: null,
    weather: null,
  });

  assert.equal(
    card.highlights.some((highlight) => highlight.key === "movies"),
    false,
  );
  assert.equal(card.highlights.find(({ key }) => key === "events")?.value, "1");
  assert.equal(card.highlights.find(({ key }) => key === "events")?.label, "događaj");
});

test("uses Montenegrin count forms for platform summaries", () => {
  const nouns = [
    ["izlazak", "izlaska", "izlazaka"],
    ["događaj", "događaja", "događaja"],
    ["let", "leta", "letova"],
  ] as const;

  for (const [singular, paucal, plural] of nouns) {
    assert.equal(formatCount(0, singular, paucal, plural), `0 ${plural}`);
    assert.equal(formatCount(1, singular, paucal, plural), `1 ${singular}`);
    assert.equal(formatCount(2, singular, paucal, plural), `2 ${paucal}`);
    assert.equal(formatCount(4, singular, paucal, plural), `4 ${paucal}`);
    assert.equal(formatCount(5, singular, paucal, plural), `5 ${plural}`);
    assert.equal(formatCount(21, singular, paucal, plural), `21 ${singular}`);
  }
});
