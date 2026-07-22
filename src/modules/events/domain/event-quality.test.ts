import assert from "node:assert/strict";
import test from "node:test";

import { podgoricaEvent } from "../__fixtures__/events.ts";
import { assessEventQuality, runEventQualityPipeline } from "./event-quality.ts";

const now = new Date("2026-07-01T12:00:00.000Z");

test("scores complete events deterministically and warns for optional gaps", () => {
  const complete = podgoricaEvent({ description: "Detaljan opis", venueName: "KIC" });
  const first = assessEventQuality(complete, ["podgorica"], undefined, now);
  assert.equal(first.status, "accepted");
  assert.equal(first.score, 100);
  assert.deepEqual(first, assessEventQuality(complete, ["podgorica"], undefined, now));
  const optional = assessEventQuality(
    podgoricaEvent({ description: undefined, venueName: undefined }),
    ["podgorica"],
    undefined,
    now,
  );
  assert.equal(optional.status, "acceptedWithWarnings");
  assert.ok(optional.warnings.includes("missing-description"));
  assert.ok(optional.warnings.includes("missing-venue"));
});

test("rejects core identity, chronology, city, and policy failures", () => {
  assert.equal(
    assessEventQuality(podgoricaEvent({ sourceUrl: "" }), ["podgorica"], undefined, now).status,
    "rejected",
  );
  assert.equal(
    assessEventQuality(podgoricaEvent({ title: "" }), ["podgorica"], undefined, now).status,
    "rejected",
  );
  assert.equal(
    assessEventQuality(
      podgoricaEvent({ cityId: "bar", cityIds: ["bar"] }),
      ["podgorica"],
      undefined,
      now,
    ).status,
    "rejected",
  );
  assert.ok(
    assessEventQuality(
      podgoricaEvent({ endsAt: "2026-07-17T17:00:00.000Z" }),
      ["podgorica"],
      undefined,
      now,
    ).errors.includes("end-before-start"),
  );
  assert.ok(
    assessEventQuality(
      podgoricaEvent({ startsAt: "2030-07-17T18:00:00.000Z" }),
      ["podgorica"],
      undefined,
      now,
    ).errors.includes("excessively-future-event"),
  );
});

test("keeps date-only, cancelled, and postponed events while aggregating pipeline diagnostics", () => {
  const dateOnly = podgoricaEvent({
    description: "Opis",
    startDate: "2026-07-17",
    startsAt: undefined,
    venueName: "KIC",
  });
  const cancelled = podgoricaEvent({
    description: "Opis",
    id: "cancelled",
    status: "cancelled",
    venueName: "KIC",
  });
  const rejected = podgoricaEvent({ id: "rejected", sourceUrl: "" });
  const result = runEventQualityPipeline({
    candidatesDiscovered: 3,
    events: [dateOnly, cancelled, rejected],
    now,
    previousSuccessfulEventCount: 10,
    validCityIds: ["podgorica"],
  });
  assert.equal(result.acceptedWithWarnings.length, 1);
  assert.equal(result.accepted.length, 1);
  assert.equal(result.rejected.length, 1);
  assert.equal(result.diagnostics.warningCounts["date-only-event"], 1);
  assert.equal(result.diagnostics.rejectionCounts["missing-source-url"], 1);
  assert.equal(result.diagnostics.countDropWarning, true);
  assert.equal(
    result.finalEvents.some((event) => event.id === "rejected"),
    false,
  );
});
