import assert from "node:assert/strict";
import test from "node:test";

import type { CityAlert } from "../domain/city-alert.ts";
import {
  formatAdditionalLocations,
  formatCompactPowerOutageLocations,
  formatPowerOutageSummary,
  getPowerOutageDetailsLabel,
  getPowerOutageOfficialSourceUrl,
  groupPowerOutagesByDate,
  normalizePowerOutageDescription,
} from "./power-outages-ui-model.ts";

test("normalizes a duplicated outage-time preposition for the homepage", () => {
  assert.equal(
    normalizePowerOutageDescription("Planirani prekid od od 08 do 15 sati."),
    "Planirani prekid od 08 do 15 sati.",
  );
});

test("uses one explicit homepage power-outage CTA label", () => {
  assert.equal(getPowerOutageDetailsLabel("me"), "Pogledajte detalje →");
  assert.equal(getPowerOutageDetailsLabel("en"), "View details →");
});

test("uses correct Montenegrin singular and plural copy for additional locations", () => {
  const templates = {
    few: "Još {count} lokacije",
    many: "Još {count} lokacija",
    one: "Još {count} lokacija",
  };

  assert.equal(formatAdditionalLocations(1, templates, "me"), "Još 1 lokacija");
  assert.equal(formatAdditionalLocations(2, templates, "me"), "Još 2 lokacije");
  assert.equal(formatAdditionalLocations(4, templates, "me"), "Još 4 lokacije");
  assert.equal(formatAdditionalLocations(5, templates, "me"), "Još 5 lokacija");
  assert.equal(formatAdditionalLocations(21, templates, "me"), "Još 21 lokacija");
  assert.equal(formatAdditionalLocations(22, templates, "me"), "Još 22 lokacije");
  assert.equal(formatAdditionalLocations(24, templates, "me"), "Još 24 lokacije");
  assert.equal(formatAdditionalLocations(25, templates, "me"), "Još 25 lokacija");
});

test("uses singular English copy only for one additional location", () => {
  const templates = {
    few: "{count} more locations",
    many: "{count} more locations",
    one: "{count} more location",
  };

  assert.equal(formatAdditionalLocations(1, templates, "en"), "1 more location");
  assert.equal(formatAdditionalLocations(2, templates, "en"), "2 more locations");
  assert.equal(formatAdditionalLocations(4, templates, "en"), "4 more locations");
  assert.equal(formatAdditionalLocations(5, templates, "en"), "5 more locations");
  assert.equal(formatAdditionalLocations(21, templates, "en"), "21 more locations");
  assert.equal(formatAdditionalLocations(22, templates, "en"), "22 more locations");
  assert.equal(formatAdditionalLocations(24, templates, "en"), "24 more locations");
  assert.equal(formatAdditionalLocations(25, templates, "en"), "25 more locations");
});

test("formats homepage outage locations as one compact comma-separated line", () => {
  const templates = {
    few: "Još {count} lokacije",
    many: "Još {count} lokacija",
    one: "Još {count} lokacija",
  };

  assert.equal(
    formatCompactPowerOutageLocations(
      ["Liješta", "Koći", "Medun", "Dučići", "Radan", "Rašovići"],
      19,
      templates,
      "me",
    ),
    "Liješta, Koći, Medun, Dučići, Radan, Rašovići + još 19 lokacija",
  );
  assert.equal(
    formatCompactPowerOutageLocations(["Liješta", "Koći"], undefined, templates, "me"),
    "Liješta, Koći",
  );
});

test("formats the planned-outage summary with Montenegrin singular and plural forms", () => {
  const templates = {
    days: { many: "tokom {count} dana", one: "tokom jednog dana" },
    outages: {
      many: "{count} planirana isključenja",
      one: "{count} planirano isključenje",
    },
  };

  assert.equal(
    formatPowerOutageSummary(1, 1, templates, "me"),
    "1 planirano isključenje tokom jednog dana",
  );
  assert.equal(
    formatPowerOutageSummary(2, 2, templates, "me"),
    "2 planirana isključenja tokom 2 dana",
  );
  assert.equal(
    formatPowerOutageSummary(5, 5, templates, "me"),
    "5 planirana isključenja tokom 5 dana",
  );
  assert.equal(
    formatPowerOutageSummary(21, 2, templates, "me"),
    "21 planirano isključenje tokom 2 dana",
  );
});

test("groups power outages by their local Podgorica date and sorts cards by start time", () => {
  const earlyTomorrow = outage("early-tomorrow", "2026-07-22T05:00:00.000Z");
  const laterToday = outage("later-today", "2026-07-21T14:00:00.000Z");
  const earlyToday = outage("early-today", "2026-07-21T06:00:00.000Z");

  const groups = groupPowerOutagesByDate([earlyTomorrow, laterToday, earlyToday]);

  assert.deepEqual(
    groups.map(({ outages }) => outages.map(({ id }) => id)),
    [["early-today", "later-today"], ["early-tomorrow"]],
  );
});

test("preserves the official source URL for the secondary external link", () => {
  assert.equal(
    getPowerOutageOfficialSourceUrl(outage("source", "2026-07-21T06:00:00.000Z")),
    "https://cedis.me/servisne-informacije/",
  );
});

function outage(id: string, startsAt: string): CityAlert {
  return {
    affectedArea: { kind: "source", value: "Centar" },
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
