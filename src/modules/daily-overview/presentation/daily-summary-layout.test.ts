import assert from "node:assert/strict";
import test from "node:test";

import { dailySummaryLayout } from "./daily-summary-layout.ts";

test("uses only one horizontal and one vertical divider for the mobile two-by-two summary", () => {
  assert.match(dailySummaryLayout.gridClassName, /grid-cols-2/);
  assert.match(dailySummaryLayout.verticalDividerClassName, /\bw-px\b/);
  assert.match(dailySummaryLayout.horizontalDividerClassName, /\bh-px\b/);
  assert.doesNotMatch(dailySummaryLayout.itemClassName, /(?:^|-)border|\bdivide-/);
  assert.doesNotMatch(dailySummaryLayout.verticalDividerClassName, /\bborder/);
  assert.doesNotMatch(dailySummaryLayout.horizontalDividerClassName, /\bborder/);
});
