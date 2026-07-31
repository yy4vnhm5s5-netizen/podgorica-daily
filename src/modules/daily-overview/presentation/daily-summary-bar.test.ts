import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { getDailySummaryItemIds } from "./daily-summary-items.ts";

test("always includes weather and includes only publicly available summary modules", () => {
  assert.deepEqual(
    getDailySummaryItemIds({ cinema: true, events: true, goingOut: true, seaWaterQuality: false }),
    ["weather", "goingOut", "events", "cinema"],
  );
  assert.deepEqual(
    getDailySummaryItemIds({
      cinema: false,
      events: false,
      goingOut: true,
      seaWaterQuality: false,
    }),
    ["weather", "goingOut"],
  );
  assert.deepEqual(
    getDailySummaryItemIds({ cinema: false, events: false, goingOut: true, seaWaterQuality: true }),
    ["weather", "goingOut", "seaWaterQuality"],
  );
});

test("keeps each summary value and its existing label on one compact line", async () => {
  const source = await readFile(new URL("./daily-summary-bar.tsx", import.meta.url), "utf8");

  assert.match(source, /flex min-w-0 items-baseline gap-1\.5/u);
  assert.match(source, /text-\[1\.375rem\][\s\S]*?sm:text-\[1\.65rem\]/u);
  assert.match(source, /flex size-8 shrink-0/u);
  assert.doesNotMatch(source, /block text-xs font-normal text-muted-foreground/u);
});
