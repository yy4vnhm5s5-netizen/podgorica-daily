import assert from "node:assert/strict";
import test from "node:test";

import { getStatusBadgeToneClassName } from "./status-badge-classes.ts";

test("uses the accessible slate text token for neutral status badges", () => {
  const neutralClasses = getStatusBadgeToneClassName("neutral");

  assert.match(neutralClasses, /text-slate-600/u);
  assert.doesNotMatch(neutralClasses, /text-muted-foreground/u);
});
