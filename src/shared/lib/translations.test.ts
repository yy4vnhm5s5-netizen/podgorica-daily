import assert from "node:assert/strict";
import test from "node:test";

import { getTranslations } from "./translations.ts";

test("localizes emergency-number labels in English", () => {
  const { emergencyNumbers } = getTranslations("en").dashboard;

  assert.deepEqual(emergencyNumbers, {
    ambulance: "Ambulance",
    fireService: "Fire service",
    label: "Emergency numbers",
    police: "Police",
  });
});
