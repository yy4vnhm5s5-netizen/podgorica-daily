import assert from "node:assert/strict";
import test from "node:test";

import { formatRelativeTime } from "./date.ts";

const now = new Date("2026-07-19T12:00:00.000Z");

test("formats deterministic Montenegrin relative times", () => {
  assert.equal(formatRelativeTime(new Date("2026-07-19T11:59:30.000Z"), { locale: "me", now }), "upravo");
  assert.equal(formatRelativeTime(new Date("2026-07-19T11:52:00.000Z"), { locale: "me", now }), "prije 8 minuta");
  assert.equal(formatRelativeTime(new Date("2026-07-19T11:00:00.000Z"), { locale: "me", now }), "prije 1 sat");
  assert.equal(formatRelativeTime(new Date("2026-07-19T09:00:00.000Z"), { locale: "me", now }), "prije 3 sata");
  assert.equal(formatRelativeTime(new Date("2026-07-18T12:00:00.000Z"), { locale: "me", now }), "prije 1 dan");
  assert.equal(formatRelativeTime(new Date("2026-07-14T12:00:00.000Z"), { locale: "me", now }), "prije 5 dana");
});

test("formats deterministic English relative times", () => {
  assert.equal(formatRelativeTime(new Date("2026-07-19T11:00:00.000Z"), { locale: "en", now }), "1 hour ago");
  assert.equal(formatRelativeTime(new Date("2026-07-17T12:00:00.000Z"), { locale: "en", now }), "2 days ago");
});
