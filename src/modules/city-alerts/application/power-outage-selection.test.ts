import assert from "node:assert/strict";
import test from "node:test";

import type { CityAlert } from "../domain/city-alert.ts";
import {
  getHomepagePowerOutageLocations,
  getPowerOutageLocations,
  getRelevantPowerOutages,
} from "./power-outage-selection.ts";

test("limits homepage power-outage locations and reports the exact remaining count", () => {
  const locations = getHomepagePowerOutageLocations(
    powerOutage(
      "scheduled",
      "Liješnje, Vrbica, Tološi, Tivatska ulica, Ulica Boška Buhe, Ubli, Živkovići",
    ),
  );

  assert.deepEqual(locations.locations, [
    "Liješnje",
    "Vrbica",
    "Tološi",
    "Tivatska ulica",
    "Ulica Boška Buhe",
  ]);
  assert.equal(locations.additionalLocationCount, 2);
});

test("keeps all parsed locations and sorts every currently relevant outage", () => {
  const tomorrow = powerOutage("tomorrow", "Centar", "2026-07-22T06:00:00.000Z");
  const laterToday = powerOutage("today", "Zabjelo", "2026-07-21T14:00:00.000Z");
  const expired = { ...powerOutage("expired", "Stari aerodrom"), status: "expired" as const };

  assert.deepEqual(getPowerOutageLocations(tomorrow), ["Centar"]);
  assert.deepEqual(
    getRelevantPowerOutages([tomorrow, expired, laterToday]).map(({ id }) => id),
    ["today", "tomorrow"],
  );
});

function powerOutage(
  id: string,
  affectedArea: string,
  startsAt = "2026-07-21T12:00:00.000Z",
): CityAlert {
  return {
    affectedArea: { kind: "source", value: affectedArea },
    cityIds: ["podgorica"],
    dataMode: "live",
    description: { kind: "source", value: "Planirani prekid." },
    id,
    severity: "information",
    source: { kind: "source", value: "CEDIS" },
    sourceUrl: "https://cedis.me/servisne-informacije/",
    startsAt: new Date(startsAt),
    status: "scheduled",
    title: { kind: "source", value: "Planirano isključenje struje" },
    type: "powerOutage",
  };
}
