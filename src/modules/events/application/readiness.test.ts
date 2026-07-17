import assert from "node:assert/strict";
import test from "node:test";

import { getEventsReadiness } from "./readiness.ts";

test("reports readiness without cache paths, event contents, or diagnostics", () => {
  const result = getEventsReadiness([
    { id: "kic", state: "fresh", status: { health: "healthy" } },
    { id: "cnp", state: "unavailable", status: { health: "unavailable" } },
  ] as never);

  assert.deepEqual(result, {
    eventProviders: [
      { id: "kic", state: "fresh", status: "healthy" },
      { id: "cnp", state: "unavailable", status: "unavailable" },
    ],
    status: "degraded",
  });
  assert.equal(JSON.stringify(result).includes(".runtime"), false);
});

test("reports unavailable only when every configured event provider is unavailable", () => {
  assert.equal(
    getEventsReadiness([
      { id: "kic", state: "unavailable", status: { health: "unavailable" } },
    ] as never).status,
    "unavailable",
  );
  assert.equal(getEventsReadiness([]).status, "ready");
});
