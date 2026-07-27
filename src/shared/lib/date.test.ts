import assert from "node:assert/strict";
import test from "node:test";

import { formatDateTime, formatRelativeTime } from "./date.ts";

const now = new Date("2026-07-19T12:00:00.000Z");

test("formats a component-only option (hour/minute) without throwing, omitting the default dateStyle/timeStyle", () => {
  // Regression test for the confirmed production incident: Intl.DateTimeFormat throws when
  // dateStyle/timeStyle are combined with individual component options (hour, minute, etc.) in
  // the same options object. formatDateTime previously always injected its own dateStyle:
  // "medium", timeStyle: "short" defaults ahead of a caller's formatOptions, so any caller
  // passing a component option without also clearing both style keys produced exactly that
  // invalid combination — confirmed via production diagnostics with options
  // { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Podgorica", hour: "2-digit",
  // minute: "2-digit" }.
  const value = new Date("2026-07-28T18:05:00.000Z");

  assert.doesNotThrow(() =>
    formatDateTime(value, {
      formatOptions: { hour: "2-digit", minute: "2-digit" },
      locale: "en",
      timeZone: "Europe/Podgorica",
    }),
  );
  const { label } = formatDateTime(value, {
    formatOptions: { hour: "2-digit", minute: "2-digit" },
    locale: "en",
    timeZone: "Europe/Podgorica",
  });
  assert.match(label, /^\d{1,2}:\d{2}\s?(AM|PM)?$/i);
});

test("still applies default dateStyle/timeStyle when no component option is supplied", () => {
  const { label } = formatDateTime(new Date("2026-07-28T18:05:00.000Z"), {
    locale: "en",
    timeZone: "Europe/Podgorica",
  });

  assert.match(label, /2026/);
});

test("preserves an explicit dateStyle override alongside no component options", () => {
  const { label } = formatDateTime(new Date("2026-07-28T18:05:00.000Z"), {
    formatOptions: { dateStyle: "medium", timeStyle: undefined },
    locale: "en",
    timeZone: "Europe/Podgorica",
  });

  assert.match(label, /2026/);
  assert.doesNotMatch(label, /\d{1,2}:\d{2}/);
});

test("hour12 alone does not suppress the default dateStyle/timeStyle", () => {
  // hour12 configures how an already-selected hour is represented; it does not itself select an
  // output component and must not be treated as one, or the default dateStyle/timeStyle would be
  // incorrectly suppressed for any caller passing only hour12.
  assert.doesNotThrow(() =>
    formatDateTime(new Date("2026-07-28T18:05:00.000Z"), {
      formatOptions: { hour12: false },
      locale: "en",
      timeZone: "Europe/Podgorica",
    }),
  );
  const { label } = formatDateTime(new Date("2026-07-28T18:05:00.000Z"), {
    formatOptions: { hour12: false },
    locale: "en",
    timeZone: "Europe/Podgorica",
  });

  assert.match(label, /2026/);
  assert.match(label, /\d{1,2}:\d{2}/);
});

test("hourCycle alone does not suppress the default dateStyle/timeStyle", () => {
  assert.doesNotThrow(() =>
    formatDateTime(new Date("2026-07-28T18:05:00.000Z"), {
      formatOptions: { hourCycle: "h23" },
      locale: "en",
      timeZone: "Europe/Podgorica",
    }),
  );
  const { label } = formatDateTime(new Date("2026-07-28T18:05:00.000Z"), {
    formatOptions: { hourCycle: "h23" },
    locale: "en",
    timeZone: "Europe/Podgorica",
  });

  assert.match(label, /2026/);
  assert.match(label, /\d{1,2}:\d{2}/);
});

test("formats deterministic Montenegrin relative times", () => {
  assert.equal(
    formatRelativeTime(new Date("2026-07-19T11:59:30.000Z"), { locale: "me", now }),
    "upravo",
  );
  assert.equal(
    formatRelativeTime(new Date("2026-07-19T11:52:00.000Z"), { locale: "me", now }),
    "prije 8 minuta",
  );
  assert.equal(
    formatRelativeTime(new Date("2026-07-19T11:00:00.000Z"), { locale: "me", now }),
    "prije 1 sat",
  );
  assert.equal(
    formatRelativeTime(new Date("2026-07-19T09:00:00.000Z"), { locale: "me", now }),
    "prije 3 sata",
  );
  assert.equal(
    formatRelativeTime(new Date("2026-07-18T12:00:00.000Z"), { locale: "me", now }),
    "prije 1 dan",
  );
  assert.equal(
    formatRelativeTime(new Date("2026-07-14T12:00:00.000Z"), { locale: "me", now }),
    "prije 5 dana",
  );
});

test("formats deterministic English relative times", () => {
  assert.equal(
    formatRelativeTime(new Date("2026-07-19T11:00:00.000Z"), { locale: "en", now }),
    "1 hour ago",
  );
  assert.equal(
    formatRelativeTime(new Date("2026-07-17T12:00:00.000Z"), { locale: "en", now }),
    "2 days ago",
  );
});
