import assert from "node:assert/strict";
import test from "node:test";

import type { CityAlert } from "../domain/city-alert.ts";
import { selectNextPowerOutage } from "./select-next-power-outage.ts";

function powerOutage(id: string, startsAt: string): CityAlert {
  return {
    affectedArea: { kind: "source", value: id },
    cityIds: ["podgorica"],
    dataMode: "live",
    description: { kind: "source", value: "Planirano isključenje." },
    id,
    severity: "information",
    source: { kind: "source", value: "CEDIS" },
    startsAt: new Date(startsAt),
    status: "scheduled",
    title: { kind: "source", value: "Planirano isključenje struje" },
    type: "powerOutage",
  };
}

test("selects an outage later today before a cached outage tomorrow", () => {
  const selected = selectNextPowerOutage([
    powerOutage("tomorrow", "2026-07-22T06:00:00.000Z"),
    powerOutage("later-today", "2026-07-21T16:00:00.000Z"),
  ]);

  assert.equal(selected?.id, "later-today");
});

test("selects tomorrow when no outage remains today", () => {
  const selected = selectNextPowerOutage([
    powerOutage("day-after-tomorrow", "2026-07-23T06:00:00.000Z"),
    powerOutage("tomorrow", "2026-07-22T06:00:00.000Z"),
  ]);

  assert.equal(selected?.id, "tomorrow");
});

test("selects the earliest outage across multiple future dates", () => {
  const selected = selectNextPowerOutage([
    powerOutage("third", "2026-07-24T06:00:00.000Z"),
    powerOutage("first", "2026-07-22T08:00:00.000Z"),
    powerOutage("second", "2026-07-23T06:00:00.000Z"),
  ]);

  assert.equal(selected?.id, "first");
});

test("returns no selection when there are no planned power outages", () => {
  assert.equal(selectNextPowerOutage([]), undefined);
});
