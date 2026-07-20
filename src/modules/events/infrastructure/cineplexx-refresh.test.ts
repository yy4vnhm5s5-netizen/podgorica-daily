import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { createCineplexxBrowserRenderer } from "./cineplexx-browser-renderer.ts";
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

test("logs DOM mismatch diagnostics when the rendered programme is incomplete", async () => {
  const calls: unknown[][] = [];
  const originalError = console.error;
  console.error = (...arguments_: unknown[]) => calls.push(arguments_);

  try {
    const result = await refreshCineplexxProgramme({
      cachePath: "/tmp/cineplexx.json",
      context,
      renderer: createCineplexxBrowserRenderer({
        execute: async () => ({
          stderr: "",
          stdout: "<title>Cineplexx</title><main>Loading</main>",
        }),
        resolveExecutable: async () => "chromium",
      }),
    });

    assert.equal(result.success, false);
  } finally {
    console.error = originalError;
  }

  const diagnostic = parseLoggedEvent(calls, "cineplexx-refresh-failed");
  assert.equal(diagnostic.phase, "dom-dump");
  assert.ok(diagnostic.error);
  assert.ok(diagnostic.dom);
  assert.equal(diagnostic.error.class, "CineplexxBrowserError");
  assert.deepEqual(diagnostic.dom, {
    expectedBookingSelectorExists: false,
    expectedSessionSelectorExists: false,
    finalUrl: "https://www.cineplexx.me/cinemas/CINEPLEXX-PODGORICA/",
    htmlLength: 44,
    title: "Cineplexx",
  });
});

test("logs zero screenings as a parser outcome instead of a DOM mismatch", async () => {
  const calls: unknown[][] = [];
  const originalInfo = console.info;
  console.info = (...arguments_: unknown[]) => calls.push(arguments_);

  try {
    const result = await refreshCineplexxProgramme({
      cachePath: "/tmp/cineplexx.json",
      context,
      renderer: {
        renderProgramme: async () =>
          '<title>Cineplexx</title><p>Danas</p><li class="l-sessions__item"><a href="/purchase/wizard/1">Rezervacija</a></li>',
      },
      writeCache: async () => undefined,
    });

    assert.equal(result.success, true);
  } finally {
    console.info = originalInfo;
  }

  const diagnostic = parseLoggedEvent(calls, "cineplexx-refresh-zero-screenings");
  assert.equal(diagnostic.phase, "parser");
  assert.equal(diagnostic.reason, "zero-screenings");
  assert.ok(diagnostic.dom);
  assert.equal(diagnostic.dom.expectedBookingSelectorExists, true);
  assert.equal(diagnostic.dom.expectedSessionSelectorExists, true);
});

test("logs cache-write failures with their precise refresh phase", async () => {
  const calls: unknown[][] = [];
  const originalError = console.error;
  console.error = (...arguments_: unknown[]) => calls.push(arguments_);

  try {
    const result = await refreshCineplexxProgramme({
      cachePath: "/tmp/cineplexx.json",
      context,
      now: () => new Date("2026-07-20T08:00:00.000Z"),
      renderer: { renderProgramme: async () => readFile(fixturePath, "utf8") },
      writeCache: async () => {
        throw new Error("Disk is read-only");
      },
    });

    assert.equal(result.success, false);
  } finally {
    console.error = originalError;
  }

  const diagnostic = parseLoggedEvent(calls, "cineplexx-refresh-failed");
  assert.equal(diagnostic.phase, "cache-write");
  assert.ok(diagnostic.error);
  assert.equal(diagnostic.error.class, "Error");
  assert.equal(diagnostic.error.message, "Disk is read-only");
});

interface CineplexxRefreshDiagnostic {
  dom?: {
    expectedBookingSelectorExists?: boolean;
    expectedSessionSelectorExists?: boolean;
    finalUrl?: string;
    htmlLength?: number;
    title?: string;
  };
  error?: { class?: string; message?: string };
  event?: string;
  phase?: string;
  reason?: string;
}

function parseLoggedEvent(calls: readonly unknown[][], event: string): CineplexxRefreshDiagnostic {
  const message = calls
    .flatMap(([value]) => (typeof value === "string" ? [value] : []))
    .map((value) => JSON.parse(value) as unknown)
    .filter(isCineplexxRefreshDiagnostic)
    .find((value) => value.event === event);
  assert.ok(message, `Expected ${event} diagnostic.`);
  return message;
}

function isCineplexxRefreshDiagnostic(value: unknown): value is CineplexxRefreshDiagnostic {
  return typeof value === "object" && value !== null;
}
