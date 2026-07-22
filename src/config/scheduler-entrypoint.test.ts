import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

const schedulerPath = fileURLToPath(
  new URL("../../scripts/scheduler-entrypoint.sh", import.meta.url),
);

test("uses Europe/Podgorica civil time and schedules Cineplexx exactly twice daily", async () => {
  const scheduler = await readFile(schedulerPath, "utf8");

  assert.match(scheduler, /TZ="\$\{TZ:-Europe\/Podgorica\}"/);
  assert.match(scheduler, /05:00\|17:00\) run_collector "cineplexx-events"/);
  assert.doesNotMatch(scheduler, /05\) run_collector "cineplexx-events"/);
  assert.doesNotMatch(scheduler, /17\)[\s\S]*cineplexx-events/);
});

test("keeps every provider on its intended independent cadence", async () => {
  const scheduler = await readFile(schedulerPath, "utf8");

  assert.match(scheduler, /00\|15\|30\|45\) run_collector "podgorica-flights"/);
  assert.match(scheduler, /00:10\|02:10[\s\S]*22:10[\s\S]*run_collector "vikpg"/);
  assert.match(scheduler, /01:25\|07:25\|13:25\|19:25\) run_collector "cedis"/);
  assert.match(scheduler, /00:05\|03:05[\s\S]*21:05[\s\S]*"standard-events"/);
  assert.match(scheduler, /01:00\|04:00[\s\S]*22:00[\s\S]*"montegigs-going-out"/);
  assert.match(scheduler, /06:45\|18:45\) run_collector "zpcg-railway"/);
});
