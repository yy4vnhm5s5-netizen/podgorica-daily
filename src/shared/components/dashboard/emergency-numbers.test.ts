import assert from "node:assert/strict";
import test from "node:test";

import {
  emergencyNumbersStripLayout,
  getEmergencyNumbers,
} from "./emergency-numbers.ts";

test("provides exactly the three emergency telephone links", () => {
  const numbers = getEmergencyNumbers({
    ambulance: "Hitna",
    fireService: "Vatrogasci",
    police: "Policija",
  });

  assert.deepEqual(numbers, [
    { href: "tel:124", id: "ambulance", label: "Hitna", number: "124" },
    { href: "tel:122", id: "police", label: "Policija", number: "122" },
    { href: "tel:123", id: "fireService", label: "Vatrogasci", number: "123" },
  ]);
});

test("uses a compact three-column layout without horizontal overflow utilities", () => {
  assert.match(emergencyNumbersStripLayout.list, /grid-cols-3/);
  assert.match(emergencyNumbersStripLayout.list, /divide-x/);
  assert.match(emergencyNumbersStripLayout.item, /min-w-0/);
  assert.match(emergencyNumbersStripLayout.link, /min-h-12/);
  assert.match(emergencyNumbersStripLayout.link, /py-1/);
});
