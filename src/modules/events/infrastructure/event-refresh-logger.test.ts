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
  assert.equal(emitted.length, 6);
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
    ],
  );
  assert.equal(
    kicFailure.message,
    "events-refresh-provider-failed provider=kic error=Error",
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
