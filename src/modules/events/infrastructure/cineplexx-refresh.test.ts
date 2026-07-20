import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { refreshCineplexxProgramme } from "./cineplexx-refresh.ts";

const fixturePath = new URL("./__fixtures__/cineplexx-podgorica-rendered.html", import.meta.url);
const context = {
  city: {
    country: "Montenegro",
    displayName: "Podgorica",
    enabled: true,
    id: "podgorica" as const,
    latitude: 42,
    longitude: 19,
    slug: "podgorica",
    timezone: "Europe/Podgorica",
  },
  locale: "me" as const,
  timezone: "Europe/Podgorica",
};

test("writes normalized Cineplexx screenings through the shared cache contract", async () => {
  let stored: unknown;
  const result = await refreshCineplexxProgramme({
    cachePath: "/tmp/cineplexx.json",
    context,
    now: () => new Date("2026-07-20T08:00:00.000Z"),
    renderer: { renderProgramme: async () => readFile(fixturePath, "utf8") },
    writeCache: async (snapshot) => {
      stored = snapshot;
    },
  });

  assert.equal(result.success, true);
  assert.equal(result.snapshot?.events.length, 3);
  assert.ok(stored);
});

test("retains a usable Cineplexx snapshot when browser rendering fails", async () => {
  const previous = {
    events: [],
    fetchedAt: "2026-07-19T08:00:00.000Z",
    freshnessStatus: "fresh" as const,
    lastSuccessfulRefreshAt: "2026-07-19T08:00:00.000Z",
    parserWarnings: [],
    provider: {
      displayName: "Cineplexx Podgorica programme",
      id: "cineplexx-podgorica",
      sourceUrl: "https://www.cineplexx.me/cinemas/CINEPLEXX-PODGORICA/",
    },
    schemaVersion: 2 as const,
    venues: [],
  };
  const result = await refreshCineplexxProgramme({
    cachePath: "/tmp/cineplexx.json",
    context,
    previousSnapshot: previous,
    renderer: {
      renderProgramme: async () => {
        throw new Error("browser unavailable");
      },
    },
  });

  assert.equal(result.success, false);
  assert.equal(result.retainedPreviousSnapshot, true);
  assert.equal(result.snapshot, previous);
});
