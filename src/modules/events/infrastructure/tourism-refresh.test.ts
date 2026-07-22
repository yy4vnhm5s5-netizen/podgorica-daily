import assert from "node:assert/strict";
import test from "node:test";
import { refreshTourismEvents } from "./tourism-refresh.ts";
const context = {
  city: {
    country: "Montenegro",
    id: "podgorica" as const,
    isActive: true,
    isMain: true,
    latitude: 42,
    longitude: 19,
    name: "Podgorica",
    slug: "podgorica",
    timezone: "Europe/Podgorica",
  },
  locale: "me" as const,
  timezone: "Europe/Podgorica",
};
test("refreshes Tourism listing through quality and atomic cache injection", async () => {
  let stored: unknown;
  const result = await refreshTourismEvents({
    cachePath: "/tmp/tourism.json",
    context,
    httpClient: {
      get: async (url) =>
        url.includes("dogadjaji-kalendar")
          ? '<a href="/calendar-event/a/">A</a>'
          : "<h1>Koncert</h1>20.07.2026. 21:00 – 23:00h",
    },
    now: () => new Date("2026-07-01T00:00:00Z"),
    writeCache: async (snapshot) => {
      stored = snapshot;
    },
  });
  assert.equal(result.success, true);
  assert.ok(stored);
  assert.equal(result.snapshot?.events.length, 1);
});
