import assert from "node:assert/strict";
import test from "node:test";

import { getLoadingSkeletonAccessibilityProps } from "./loading-skeleton-accessibility.ts";

test("loading skeleton announces only when it is the designated status region", () => {
  assert.deepEqual(
    getLoadingSkeletonAccessibilityProps({ announce: true, label: "Učitavanje događaja" }),
    {
      "aria-busy": true,
      "aria-label": "Učitavanje događaja",
      role: "status",
    },
  );
  assert.deepEqual(
    getLoadingSkeletonAccessibilityProps({ announce: false, label: "Učitavanje događaja" }),
    { "aria-hidden": true },
  );
});
