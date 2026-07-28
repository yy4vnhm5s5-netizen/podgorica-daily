import assert from "node:assert/strict";
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

test("derives generic city cards from every active registry city", () => {
  const cards = getActiveCities().map((city) =>
    createPlatformCityCardData(createCityContext(city.id), null),
  );

  assert.deepEqual(
    cards.map((card) => card.city.id),
    ["budva", "podgorica"],
  );
  const budva = cards.find((card) => card.city.id === "budva");
  assert.ok(budva);
  assert.deepEqual(
    budva.shortcuts.map((shortcut) => shortcut.label),
    ["Izlasci", "Struja"],
  );
  assert.deepEqual(
    budva.highlights.map((highlight) => highlight.key),
    ["weather", "going-out"],
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
  assert.equal(getCity("budva")?.isActive, true);
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
      name: "Budva",
      position: 1,
      url: "https://gradom.me/budva",
    },
    {
      "@type": "ListItem",
      name: "Podgorica",
      position: 2,
      url: "https://gradom.me/podgorica",
    },
  ]);
  assert.equal(JSON.stringify(structuredData).includes("budva"), true);
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
      weather: true,
    },
    events: getEmptyCityEventsReadModel(),
    flights: null,
    goingOut: { events: [event], state: "fresh" },
    railway: null,
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
      weather: true,
    },
    events: getEmptyCityEventsReadModel(),
    flights: null,
    goingOut: { events: [], state: "stale" },
    railway: null,
    weather: null,
  });

  assert.deepEqual(
    available.highlights.find(({ key }) => key === "going-out"),
    {
      accessibilityLabel: "1 izlazak u Budva",
      href: "/budva/izlasci",
      key: "going-out",
      label: "Izlasci",
      priority: 3,
      state: "available",
      value: "1 izlazak",
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
  const cineplexxProvider = { id: "cineplexx-podgorica", state: "fresh" } as CityEventsReadModel["providers"][number];

  const card = createPlatformCityCardData(context, {
    capabilities: {
      cityAlerts: true,
      events: true,
      flights: true,
      goingOut: true,
      railway: true,
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
    weather: null,
  });

  assert.equal(card.highlights.find(({ key }) => key === "events")?.value, "1 događaj");
  assert.equal(card.highlights.find(({ key }) => key === "movies")?.value, "2 filma");
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
