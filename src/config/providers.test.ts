import assert from "node:assert/strict";
import test from "node:test";

import { providerRegistry } from "./providers.ts";

test("registers only supported City Alerts providers", () => {
  assert.deepEqual(
    providerRegistry.map(({ id }) => id),
    ["cedis", "vikpg", "weather"],
  );
});
