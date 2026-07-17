import assert from "node:assert/strict";
import test from "node:test";

import { getEventRefreshExitCode, serializeEventRefreshSummary } from "./events-refresh-cli.ts";
import type { EventRefreshSummary } from "./events-refresh-runner.ts";

function summary(state: EventRefreshSummary["state"]): EventRefreshSummary {
  return {
    completedAt: "2026-07-17T12:01:00.000Z",
    providers: [
      {
        acceptedCount: 1,
        durationMs: 0,
        id: "kic",
        retainedPreviousSnapshot: false,
        state: "success",
      },
    ],
    startedAt: "2026-07-17T12:00:00.000Z",
    state,
  };
}

test("maps refresh states to safe CLI exit codes and compact output", () => {
  assert.equal(getEventRefreshExitCode(summary("success")), 0);
  assert.equal(getEventRefreshExitCode(summary("partial")), 1);
  assert.equal(getEventRefreshExitCode(summary("already-running")), 1);
  assert.equal(getEventRefreshExitCode(summary("failure")), 1);
  const output = serializeEventRefreshSummary(summary("success"));
  for (const prohibited of ["/", "Bearer", "<html", "description"])
    assert.equal(output.includes(prohibited), false);
});
