import assert from "node:assert/strict";
import test from "node:test";

import { createDailyOverview } from "./daily-overview-generator.ts";
import type { CityDataSnapshot } from "./daily-overview.ts";

const generatedAt = new Date("2026-07-17T08:00:00.000Z");

function createSnapshot(overrides: Partial<CityDataSnapshot> = {}): CityDataSnapshot {
  return {
    airQuality: { data: { category: "good" }, status: "available" },
    alerts: { data: [], status: "available" },
    events: { data: { count: 0 }, status: "available" },
    generatedAt,
    isDemoData: false,
    weather: { data: { temperatureCelsius: 20 }, status: "available" },
    ...overrides,
  };
}

test("states that there are no active alerts", () => {
  const overview = createDailyOverview(createSnapshot(), "me");

  assert.ok(overview.sentences.includes("Nema aktivnih gradskih smetnji."));
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
    "en",
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
    "en",
  );

  assert.deepEqual(overview.sentences, [
    "A weather warning is active.",
    "One power outage is active.",
    "One water outage is active.",
    "A major traffic disruption is active.",
    "Road works are affecting one area.",
  ]);
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
    "en",
  );

  assert.deepEqual(overview.sentences, [
    "There is not enough verified city data available for an overview right now.",
    "The overview will be updated when current data becomes available.",
  ]);
});

test("produces localized Montenegrin and English summaries", () => {
  const snapshot = createSnapshot({
    events: { data: { count: 2 }, status: "available" },
    weather: { data: { temperatureCelsius: 34 }, status: "available" },
  });

  const montenegrin = createDailyOverview(snapshot, "me");
  const english = createDailyOverview(snapshot, "en");

  assert.ok(montenegrin.sentences.some((sentence) => sentence.includes("neuobičajena")));
  assert.ok(english.sentences.some((sentence) => sentence.includes("unusually")));
  assert.notDeepEqual(montenegrin.sentences, english.sentences);
});
