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
    for (const event of [
      "events-refresh-started",
      "events-refresh-pipeline",
      "events-refresh-rejected-event",
      "events-refresh-provider-completed",
      "events-refresh-completed",
    ])
      emitInfo({ event });
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
    assert.equal(typeof JSON.parse(call[0] as string).event, "string");
  }

  const kicFailure = JSON.parse(errorCalls[0][0] as string);
  assert.deepEqual(kicFailure.error, {
    message: "KIC request failed",
    name: "Error",
    stack: "Error: KIC request failed",
  });
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
