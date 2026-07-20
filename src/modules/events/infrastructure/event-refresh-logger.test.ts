import assert from "node:assert/strict";
import test from "node:test";

import { emitError, emitInfo, emitInfoMessage } from "./event-refresh-logger.ts";

test("emits every structured Events diagnostic as one non-empty JSON string", () => {
  const infoCalls: unknown[][] = [];
  const errorCalls: unknown[][] = [];
  const originalInfo = console.info;
  const originalError = console.error;
  console.info = (...arguments_: unknown[]) => infoCalls.push(arguments_);
  console.error = (...arguments_: unknown[]) => errorCalls.push(arguments_);

  try {
    emitInfo({ event: "events-refresh-started", providers: ["kic", "cnp"] });
    emitInfo({
      acceptedCount: 4,
      event: "events-refresh-pipeline",
      fetchedCount: 8,
      normalizedCount: 6,
      parsedCount: 8,
      provider: "cnp",
      rejectedCount: 2,
    });
    emitInfo({
      event: "events-refresh-rejected-event",
      eventId: "12345",
      provider: "cnp",
      reasons: ["missing-date"],
    });
    emitInfo({
      acceptedCount: 4,
      event: "events-refresh-provider-completed",
      provider: "glavni-grad",
      rejectedCount: 2,
    });
    emitInfo({ event: "events-refresh-completed", providerCount: 4, state: "partial" });
    emitInfo({
      event: "events-refresh-parsed-sample",
      parsedCount: 20,
      provider: "cnp",
      sample: {
        parserWarnings: ["Missing start time", "Missing image"],
        rawDateText: "24. jul 2026",
        rawTimeText: "20:00",
        rawTitle: "",
        rawVenue: "CNP",
        startDate: "",
        startsAt: "",
      },
    });
    emitError({
      error: { message: "KIC request failed", name: "Error", stack: "Error: KIC request failed" },
      event: "events-refresh-provider-failed",
      provider: "kic",
    });
  } finally {
    console.info = originalInfo;
    console.error = originalError;
  }

  const emitted = [...infoCalls, ...errorCalls];
  assert.equal(emitted.length, 7);
  for (const call of emitted) {
    assert.equal(call.length, 1);
    assert.equal(typeof call[0], "string");
    assert.ok((call[0] as string).trim().length > 0);
    const payload = JSON.parse(call[0] as string);
    assert.equal(typeof payload.event, "string");
    assert.equal(typeof payload.message, "string");
    assert.ok(payload.message.trim());
    assert.ok(["error", "info"].includes(payload.level));
  }

  const kicFailure = JSON.parse(errorCalls[0][0] as string);
  assert.deepEqual(kicFailure.error, {
    message: "KIC request failed",
    name: "Error",
    stack: "Error: KIC request failed",
  });
  assert.deepEqual(
    infoCalls.map((call) => JSON.parse(call[0] as string).message),
    [
      "events-refresh-started providers=kic,cnp",
      "events-refresh-pipeline provider=cnp fetched=8 parsed=8 normalized=6 accepted=4 rejected=2",
      "events-refresh-rejected-event provider=cnp reasons=missing-date eventId=12345",
      "events-refresh-provider-completed provider=glavni-grad accepted=4 rejected=2",
      "events-refresh-completed state=partial providers=4",
      'events-refresh-parsed-sample provider=cnp parsed=20 title="" dateText="24. jul 2026" timeText="20:00" startDate="" startsAt="" venue="CNP" warnings="Missing start time, Missing image"',
    ],
  );
  assert.equal(
    kicFailure.message,
    "events-refresh-provider-failed provider=kic error=Error",
  );
});

test("formats parsed samples with empty values, escaped quotes, and bounded warnings", () => {
  const calls: unknown[][] = [];
  const originalInfo = console.info;
  console.info = (...arguments_: unknown[]) => calls.push(arguments_);

  try {
    emitInfo({
      event: "events-refresh-parsed-sample",
      parsedCount: 1,
      provider: "tourism-podgorica",
      sample: {
        parserWarnings: [
          'Warning with "quotes"',
          "Second warning",
          "Third warning",
          "Fourth warning must not appear",
        ],
        rawDateText: "",
        rawTimeText: " ",
        rawTitle: `  ${"Long title ".repeat(10)}with "quotes"  `,
      },
    });
  } finally {
    console.info = originalInfo;
  }

  const payload = JSON.parse(calls[0][0] as string);
  assert.equal(
    payload.message,
    'events-refresh-parsed-sample provider=tourism-podgorica parsed=1 title="Long title Long title Long title Long title Long title Long title Long title Lo…" dateText="" timeText="" startDate="" startsAt="" venue="" warnings="Warning with \\"quotes\\", Second warning, Third warning"',
  );
  assert.doesNotMatch(payload.message, /Fourth warning/);
  assert.ok(payload.message.includes('title="Long title'));
  assert.ok(payload.message.includes('\\"quotes\\"'));
});

test("keeps Cineplexx failure context visible in Railway-readable messages", () => {
  const infoCalls: unknown[][] = [];
  const errorCalls: unknown[][] = [];
  const originalInfo = console.info;
  const originalError = console.error;
  console.info = (...arguments_: unknown[]) => infoCalls.push(arguments_);
  console.error = (...arguments_: unknown[]) => errorCalls.push(arguments_);

  try {
    emitInfo({
      dom: {
        expectedBookingSelectorExists: true,
        expectedSessionSelectorExists: true,
        finalUrl: "https://www.cineplexx.me/cinemas/CINEPLEXX-PODGORICA/",
        htmlLength: 321,
        title: "Cineplexx Podgorica",
      },
      event: "cineplexx-refresh-zero-screenings",
      phase: "parser",
      reason: "zero-screenings",
    });
    emitError({
      causeClass: "Error",
      causeMessage: "spawn /usr/bin/chromium-browser ENOENT",
      chromiumExecutableMissing: true,
      error: { class: "CineplexxBrowserError", message: "Cineplexx browser renderer failed." },
      event: "cineplexx-refresh-failed",
      phase: "chromium-launch",
    });
  } finally {
    console.info = originalInfo;
    console.error = originalError;
  }

  const zeroScreenings = JSON.parse(infoCalls[0][0] as string);
  assert.equal(
    zeroScreenings.message,
    'cineplexx-refresh-zero-screenings phase=parser reason=zero-screenings title="Cineplexx Podgorica" finalUrl="https://www.cineplexx.me/cinemas/CINEPLEXX-PODGORICA/" htmlLength=321 sessions=true bookings=true',
  );
  const launchFailure = JSON.parse(errorCalls[0][0] as string);
  assert.equal(
    launchFailure.message,
    "cineplexx-refresh-failed phase=chromium-launch errorClass=CineplexxBrowserError errorMessage=Cineplexx browser renderer failed. causeClass=Error cause=spawn /usr/bin/chromium-browser ENOENT chromiumMissing=true",
  );
});

test("emits startup messages as one non-empty string", () => {
  const calls: unknown[][] = [];
  const originalInfo = console.info;
  console.info = (...arguments_: unknown[]) => calls.push(arguments_);

  try {
    emitInfoMessage("Events: cache initialization started.");
  } finally {
    console.info = originalInfo;
  }

  assert.deepEqual(calls, [["Events: cache initialization started."]]);
});
