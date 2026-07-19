import assert from "node:assert/strict";
import test from "node:test";

import { runEventQualityPipeline } from "../domain/event-quality.ts";
import { isIsoDate, type CityEvent, type EventCandidate } from "../domain/event.ts";
import {
  createEventRefreshObservability,
  logEventRefreshParsedSample,
  logEventRefreshObservability,
} from "./event-refresh-observability.ts";

const now = new Date("2026-07-19T12:00:00.000Z");
const sourceUrl = "https://example.test/event";

function event(overrides: Partial<CityEvent> = {}): CityEvent {
  return {
    category: "concert",
    cityIds: ["podgorica"],
    id: "event-one",
    language: "me",
    sourceId: "test-provider",
    sourceName: "Test provider",
    sourceReferences: [
      { sourceId: "test-provider", sourceName: "Test provider", sourceUrl },
    ],
    sourceUrl,
    startDate: "2026-07-20",
    status: "scheduled",
    tags: [],
    timezone: "Europe/Podgorica",
    title: "Test event",
    ...overrides,
  };
}

function candidate(url: string): EventCandidate {
  return {
    parserWarnings: [],
    rawTitle: "Test event",
    source: { sourceId: "test-provider", sourceName: "Test provider", sourceUrl: url },
    timezone: "Europe/Podgorica",
  };
}

test("reports pipeline counts and a deterministic reason for every rejected event", () => {
  const valid = event();
  const invalid = event({ id: "event-invalid", sourceUrl: "", title: "" });
  const duplicate = event({ id: "event-duplicate" });
  const quality = runEventQualityPipeline({
    candidatesDiscovered: 4,
    events: [valid, invalid, duplicate],
    now,
    validCityIds: ["podgorica"],
  });
  const result = createEventRefreshObservability({
    candidates: [candidate(sourceUrl), candidate("https://example.test/missing-date")],
    fetchedCount: 4,
    normalized: [
      { event: valid, parserWarnings: [], rejectionReasons: [] },
      { event: null, parserWarnings: ["Missing event date."], rejectionReasons: ["missing-date"] },
      { event: invalid, parserWarnings: [], rejectionReasons: [] },
      { event: duplicate, parserWarnings: [], rejectionReasons: [] },
    ],
    parsedCount: 4,
    provider: "test-provider",
    quality,
  });

  assert.deepEqual(result.metrics, {
    acceptedCount: 1,
    fetchedCount: 4,
    normalizedCount: 3,
    parsedCount: 4,
    rejectedCount: 3,
  });
  assert.deepEqual(
    result.rejected.map(({ eventId, reasons }) => ({ eventId, reasons })),
    [
      { eventId: undefined, reasons: ["missing-date"] },
      { eventId: "event-invalid", reasons: ["missing-title", "failed-quality-validation"] },
      { eventId: "event-duplicate", reasons: ["duplicate"] },
    ],
  );
});

test("recognizes invalid calendar dates before they enter the quality pipeline", () => {
  assert.equal(isIsoDate("2026-02-28"), true);
  assert.equal(isIsoDate("2026-02-30"), false);
});

test("logs one concise representative parsed candidate before normalization", () => {
  const calls: unknown[][] = [];
  const originalInfo = console.info;
  console.info = (...arguments_: unknown[]) => calls.push(arguments_);

  try {
    logEventRefreshParsedSample({
      candidates: [
        {
          ...candidate(sourceUrl),
          parserWarnings: ["First warning", "Second warning"],
          rawDescription: `  ${"Long source text ".repeat(40)}  `,
          rawTitle: "  Example event title  ",
        },
      ],
      provider: "test-provider",
    });
  } finally {
    console.info = originalInfo;
  }

  assert.equal(calls.length, 1);
  assert.equal(calls[0].length, 1);
  const payload = JSON.parse(calls[0][0] as string);
  assert.equal(payload.event, "events-refresh-parsed-sample");
  assert.equal(payload.message, "events-refresh-parsed-sample provider=test-provider parsed=1");
  assert.equal(payload.sample.rawTitle, "Example event title");
  assert.deepEqual(payload.sample.parserWarnings, ["First warning", "Second warning"]);
  assert.ok(payload.sample.rawDescription.length <= 240);
  assert.match(payload.sample.rawDescription, /…$/);
});

test("logs pipeline diagnostics as one parseable JSON string per event", () => {
  const calls: unknown[][] = [];
  const originalInfo = console.info;
  console.info = (...arguments_: unknown[]) => calls.push(arguments_);

  try {
    logEventRefreshObservability({
      candidates: [candidate(sourceUrl)],
      fetchedCount: 1,
      normalized: [
        { event: null, parserWarnings: ["Missing event title."], rejectionReasons: ["missing-title"] },
      ],
      parsedCount: 1,
      provider: "test-provider",
      quality: runEventQualityPipeline({
        candidatesDiscovered: 1,
        events: [],
        now,
        validCityIds: ["podgorica"],
      }),
    });
  } finally {
    console.info = originalInfo;
  }

  assert.equal(calls.length, 2);
  for (const call of calls) {
    assert.equal(call.length, 1);
    assert.equal(typeof call[0], "string");
    assert.ok((call[0] as string).trim());
    const payload = JSON.parse(call[0] as string);
    assert.ok(payload.event);
    assert.ok(payload.message.startsWith(payload.event));
    assert.equal(payload.level, "info");
  }
  assert.equal(JSON.parse(calls[0][0] as string).event, "events-refresh-pipeline");
  assert.equal(JSON.parse(calls[1][0] as string).event, "events-refresh-rejected-event");
});
