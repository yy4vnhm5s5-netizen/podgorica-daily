import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { getRovingTabIndex } from "./roving-tab-index.ts";

test("only the selected tab participates in sequential keyboard navigation", () => {
  assert.equal(getRovingTabIndex(true), 0);
  assert.equal(getRovingTabIndex(false), -1);
});

test("each public tabset applies the roving tab index", async () => {
  const [flightsCard, cityServicesPanel] = await Promise.all([
    readFile(
      new URL("../../modules/flights/presentation/airport-flights-card.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../../modules/city-alerts/presentation/city-services-panel.tsx", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(flightsCard, /tabIndex=\{getRovingTabIndex\(isSelected\)\}/);
  assert.match(cityServicesPanel, /tabIndex=\{getRovingTabIndex\(isSelected\)\}/);
});
