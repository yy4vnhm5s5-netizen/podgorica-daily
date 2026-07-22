import assert from "node:assert/strict";
import test from "node:test";

import { createDailyOverview } from "./daily-overview-generator.ts";
import type { CityDataSnapshot } from "./daily-overview.ts";

const generatedAt = new Date("2026-07-17T08:00:00.000Z");
const city = {
  country: "Montenegro",
  id: "podgorica" as const,
  isActive: true,
  isMain: true,
  latitude: 42.441,
  longitude: 19.263,
  name: "Podgorica",
  slug: "podgorica",
  timezone: "Europe/Podgorica",
};
const contexts = {
  en: { city, locale: "en" as const, timezone: city.timezone },
  me: { city, locale: "me" as const, timezone: city.timezone },
};

function createSnapshot(overrides: Partial<CityDataSnapshot> = {}): CityDataSnapshot {
  return {
    airQuality: { data: { category: "good" }, status: "available" },
    alerts: { data: [], status: "available" },
    cityIds: ["podgorica"],
    events: { data: { count: 0 }, status: "available" },
    generatedAt,
    isDemoData: false,
    weather: { data: { temperatureCelsius: 20 }, status: "available" },
    ...overrides,
  };
}

test("states that there are no active alerts", () => {
  const overview = createDailyOverview(createSnapshot(), contexts.me);

  assert.ok(overview.sentences.includes("Nema aktivnih gradskih smetnji."));
  assert.equal(overview.airQualityCategory, "good");
  assert.equal(overview.eventsToday, 0);
  assert.equal(overview.temperatureCelsius, 20);
  assert.ok(overview.sentences.length >= 2);
  assert.ok(overview.sentences.length <= 5);
});

test("prioritizes critical alerts", () => {
  const overview = createDailyOverview(
    createSnapshot({
      alerts: {
        data: [
          { isActive: true, isMajor: true, severity: "critical", type: "powerOutage" },
          { isActive: true, isMajor: true, severity: "warning", type: "roadWorks" },
        ],
        status: "available",
      },
    }),
    contexts.en,
  );

  assert.equal(overview.sentences[0], "There is one critical city alert.");
  assert.ok(overview.sentences.includes("One power outage is active."));
});

test("summarizes multiple alert types without exceeding five sentences", () => {
  const overview = createDailyOverview(
    createSnapshot({
      alerts: {
        data: [
          { isActive: true, isMajor: true, severity: "warning", type: "weatherWarning" },
          { isActive: true, isMajor: true, severity: "warning", type: "powerOutage" },
          { isActive: true, isMajor: true, severity: "warning", type: "waterOutage" },
          { isActive: true, isMajor: true, severity: "warning", type: "trafficDisruption" },
          { isActive: true, isMajor: false, severity: "warning", type: "roadWorks" },
        ],
        status: "available",
      },
    }),
    contexts.en,
  );

  assert.deepEqual(overview.sentences, [
    "A weather warning is active.",
    "One power outage is active.",
    "One water outage is active.",
    "A major traffic disruption is active.",
    "Road works are affecting one area.",
  ]);
  assert.equal(overview.airQualityCategory, "good");
});

test("uses a safe summary when every category is unavailable", () => {
  const unavailable = { status: "unavailable" } as const;
  const overview = createDailyOverview(
    createSnapshot({
      airQuality: unavailable,
      alerts: unavailable,
      events: unavailable,
      weather: unavailable,
    }),
    contexts.en,
  );

  assert.deepEqual(overview.sentences, [
    "There is not enough verified city data available for an overview right now.",
    "The overview will be updated when current data becomes available.",
  ]);
  assert.equal(overview.airQualityCategory, undefined);
  assert.equal(overview.eventsToday, undefined);
  assert.equal(overview.temperatureCelsius, undefined);
});

test("produces localized Montenegrin and English summaries", () => {
  const snapshot = createSnapshot({
    events: { data: { count: 2 }, status: "available" },
    weather: { data: { temperatureCelsius: 34 }, status: "available" },
  });

  const montenegrin = createDailyOverview(snapshot, contexts.me);
  const english = createDailyOverview(snapshot, contexts.en);

  assert.ok(montenegrin.sentences.some((sentence) => sentence.includes("neuobičajena")));
  assert.ok(english.sentences.some((sentence) => sentence.includes("unusually")));
  assert.notDeepEqual(montenegrin.sentences, english.sentences);
});

test("mentions an active normalized power outage in Montenegrin", () => {
  const overview = createDailyOverview(
    createSnapshot({
      alerts: {
        data: [
          {
            isActive: true,
            isMajor: false,
            severity: "information",
            type: "powerOutage",
          },
        ],
        status: "available",
      },
    }),
    contexts.me,
  );
  assert.ok(
    overview.sentences.includes("Aktivan je jedan prekid napajanja električnom energijom."),
  );
});

test("mentions an upcoming normalized power outage in English", () => {
  const overview = createDailyOverview(
    createSnapshot({
      alerts: {
        data: [
          {
            isActive: false,
            isMajor: false,
            isUpcoming: true,
            severity: "information",
            type: "powerOutage",
          },
        ],
        status: "available",
      },
    }),
    contexts.en,
  );
  assert.ok(overview.sentences.includes("One planned power outage is upcoming."));
});

test("does not invent outages when the alert source is unavailable", () => {
  const overview = createDailyOverview(
    createSnapshot({ alerts: { status: "unavailable" } }),
    contexts.en,
  );
  assert.ok(!overview.sentences.some((sentence) => sentence.includes("power outage")));
});

test("summarizes supplied event data in Montenegrin and English", () => {
  const snapshot = createSnapshot({
    events: {
      data: { concertsThisEvening: 2, count: 2, eventsThisWeekend: 7, eventsToday: 4 },
      status: "available",
    },
  });

  assert.ok(
    createDailyOverview(snapshot, contexts.me).sentences.includes(
      "Večeras su najavljena 2 koncerta.",
    ),
  );
  assert.ok(
    createDailyOverview(snapshot, contexts.en).sentences.includes(
      "Two concerts are scheduled this evening.",
    ),
  );
});
