import type { EventRefreshSummary } from "./events-refresh-runner.ts";

function getEventRefreshExitCode(summary: EventRefreshSummary) {
  return summary.state === "success" ? 0 : 1;
}

function serializeEventRefreshSummary(summary: EventRefreshSummary) {
  return JSON.stringify(summary);
}

export { getEventRefreshExitCode, serializeEventRefreshSummary };
