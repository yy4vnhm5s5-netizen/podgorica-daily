import assert from "node:assert/strict";
import test from "node:test";

import { getDatePresetRange, matchesDatePreset } from "./date-preset.ts";

const timeZone = "Europe/Podgorica";

test("uses the established local today, tomorrow and upcoming date semantics", () => {
  const now = new Date("2026-08-06T10:00:00.000Z");

  assert.deepEqual(getDatePresetRange("today", timeZone, now), {
    end: "2026-08-06",
    start: "2026-08-06",
  });
  assert.deepEqual(getDatePresetRange("tomorrow", timeZone, now), {
    end: "2026-08-07",
    start: "2026-08-07",
  });
  assert.deepEqual(getDatePresetRange("upcoming", timeZone, now), { start: "2026-08-06" });
  assert.equal(matchesDatePreset({ date: "2026-08-06", now, preset: "upcoming", timeZone }), true);
  assert.equal(matchesDatePreset({ date: "2026-08-05", now, preset: "upcoming", timeZone }), false);
});

test("defines this weekend as Friday evening, Saturday and Sunday in the current local week", () => {
  const weekdayBeforeWeekend = new Date("2026-08-06T10:00:00.000Z");
  const friday = new Date("2026-08-07T10:00:00.000Z");
  const saturday = new Date("2026-08-08T10:00:00.000Z");
  const sunday = new Date("2026-08-09T10:00:00.000Z");

  assert.equal(
    matchesDatePreset({
      date: "2026-08-06",
      now: weekdayBeforeWeekend,
      preset: "weekend",
      timeZone,
    }),
    false,
  );
  assert.equal(
    matchesDatePreset({
      date: "2026-08-07",
      now: friday,
      preset: "weekend",
      startsAt: "2026-08-07T15:59:00.000Z",
      timeZone,
    }),
    false,
  );
  assert.equal(
    matchesDatePreset({
      date: "2026-08-07",
      now: friday,
      preset: "weekend",
      startsAt: "2026-08-07T16:00:00.000Z",
      timeZone,
    }),
    true,
  );
  assert.equal(
    matchesDatePreset({ date: "2026-08-08", now: saturday, preset: "weekend", timeZone }),
    true,
  );
  assert.equal(
    matchesDatePreset({ date: "2026-08-09", now: sunday, preset: "weekend", timeZone }),
    true,
  );
});
