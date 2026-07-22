import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { tmpdir } from "node:os";

import { runCnpCollector } from "./cnp-collector.ts";
import { CnpFetchError, type CnpHttpClient } from "./cnp-http-client.ts";
import { readEventCacheSnapshot, type EventCacheSnapshot } from "./events-cache.ts";
import { refreshCnpEvents, type CnpRefreshResult } from "./cnp-refresh.ts";

const fixtures = new URL("./__fixtures__/", import.meta.url);
const cnpRepertoireUrl = "https://cnp.me/repertoar/";
const fixedNow = () => new Date("2026-07-17T10:00:00.000Z");
const context = {
  city: {
    country: "Montenegro",
    id: "podgorica" as const,
    isActive: true,
    isMain: true,
    latitude: 42.441,
    longitude: 19.263,
    name: "Podgorica",
    slug: "podgorica",
    timezone: "Europe/Podgorica",
  },
  locale: "me" as const,
  timezone: "Europe/Podgorica",
};

const fixture = (name: string) => readFile(new URL(name, fixtures), "utf8");

const fixtureClient = (pages: Record<string, string>): CnpHttpClient => ({
  get: async (url) => {
    const page = pages[url];
    if (!page) throw new CnpFetchError("cnp-request-failed", "Fixture request failed.");
    return page;
  },
});

async function withTemporaryCache(run: (cachePath: string) => Promise<void>) {
  const directory = await mkdtemp(join(tmpdir(), "podgorica-daily-cnp-"));
  try {
    await run(join(directory, "cnp-events.json"));
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
}

async function standardPages() {
  return {
    [cnpRepertoireUrl]: await fixture("cnp-listing.html"),
    "https://cnp.me/hamlet/": await fixture("cnp-theatre.html"),
    "https://cnp.me/hamlet-21-july/": await fixture("cnp-date-only-free-postponed.html"),
    "https://cnp.me/romeo/": await fixture("cnp-concert-unknown-venue.html"),
  };
}

test("refreshes CNP fixtures, writes an atomic cache, and returns Event Quality diagnostics", async () => {
  await withTemporaryCache(async (cachePath) => {
    const result = await refreshCnpEvents({
      cachePath,
      context,
      httpClient: fixtureClient(await standardPages()),
      now: fixedNow,
    });

    assert.equal(result.classification, "fresh");
    assert.equal(result.success, true);
    assert.equal(result.detailPagesRequested, 3);
    assert.equal(result.diagnostics?.candidatesDiscovered, 3);
    assert.equal(result.diagnostics?.normalizedCount, 3);
    assert.equal(result.diagnostics?.finalEventCount, 3);
    assert.equal(result.diagnostics?.rejectedCount, 0);
    assert.equal(result.snapshot?.events.length, 3);
    assert.equal((await readEventCacheSnapshot(cachePath))?.events.length, 3);
    assert.deepEqual(
      (await readdir(join(cachePath, ".."))).filter((name) => name.endsWith(".tmp")),
      [],
    );
  });
});

test("refreshes the current CNP table repertoire without requesting unrelated detail pages", async () => {
  await withTemporaryCache(async (cachePath) => {
    const result = await refreshCnpEvents({
      cachePath,
      context,
      httpClient: fixtureClient({
        [cnpRepertoireUrl]: await fixture("cnp-repertoire-table.html"),
      }),
      now: fixedNow,
    });

    assert.equal(result.success, true);
    assert.equal(result.detailPagesRequested, 0);
    assert.equal(result.diagnostics?.candidatesDiscovered, 2);
    assert.equal(result.snapshot?.events.length, 2);
    assert.equal(result.snapshot?.events[0]?.title, "ROMEO I JULIJA");
  });
});

test("keeps accepted CNP events when a detail record is malformed", async () => {
  await withTemporaryCache(async (cachePath) => {
    const result = await refreshCnpEvents({
      cachePath,
      context,
      httpClient: fixtureClient({
        [cnpRepertoireUrl]: '<a href="/hamlet/">Hamlet</a><a href="/broken/">Broken</a>',
        "https://cnp.me/broken/": "<h1>Nepotpun zapis</h1><article>Bez termina.</article>",
        "https://cnp.me/hamlet/": await fixture("cnp-theatre.html"),
      }),
      now: fixedNow,
    });

    assert.equal(result.success, true);
    assert.equal(result.snapshot?.events.length, 1);
    assert.equal(result.diagnostics?.normalizedCount, 1);
    assert.equal(result.diagnostics?.rejectedCount, 0);
    assert.ok(result.snapshot?.parserWarnings.includes("CNP article date was unavailable."));
  });
});

test("deduplicates repeated CNP performances while preserving a separate date", async () => {
  await withTemporaryCache(async (cachePath) => {
    const result = await refreshCnpEvents({
      cachePath,
      context,
      httpClient: fixtureClient({
        [cnpRepertoireUrl]: [
          '<a href="/hamlet/">Hamlet</a>',
          '<a href="/hamlet-copy/">Hamlet duplicate</a>',
          '<a href="/hamlet-21-july/">Hamlet second date</a>',
        ].join(""),
        "https://cnp.me/hamlet-copy/": await fixture("cnp-theatre.html"),
        "https://cnp.me/hamlet-21-july/": await fixture("cnp-date-only-free-postponed.html"),
        "https://cnp.me/hamlet/": await fixture("cnp-theatre.html"),
      }),
      now: fixedNow,
    });

    assert.equal(result.diagnostics?.deduplicatedCount, 1);
    assert.equal(result.snapshot?.events.length, 2);
  });
});

test("protects a prior valid CNP cache when refresh yields zero valid events", async () => {
  await withTemporaryCache(async (cachePath) => {
    const initial = await refreshCnpEvents({
      cachePath,
      context,
      httpClient: fixtureClient(await standardPages()),
      now: fixedNow,
    });
    const previousSnapshot = initial.snapshot;
    assert.ok(previousSnapshot);

    const result = await refreshCnpEvents({
      cachePath,
      context,
      httpClient: fixtureClient({
        [cnpRepertoireUrl]: '<a href="/broken/">Broken</a>',
        "https://cnp.me/broken/": "<h1>Nepotpun zapis</h1><article>Bez termina.</article>",
      }),
      now: fixedNow,
      previousSnapshot,
    });

    assert.equal(result.classification, "retained");
    assert.equal(result.zeroResultProtectionTriggered, true);
    assert.equal(result.snapshot, previousSnapshot);
    assert.equal(result.diagnostics?.previousSuccessfulEventCount, 3);
    assert.equal(result.diagnostics?.finalEventCount, 0);
    assert.equal((await readEventCacheSnapshot(cachePath))?.events.length, 3);
  });
});

test("writes a valid count drop and reports it without triggering zero-result protection", async () => {
  await withTemporaryCache(async (cachePath) => {
    const initial = await refreshCnpEvents({
      cachePath,
      context,
      httpClient: fixtureClient(await standardPages()),
      now: fixedNow,
    });
    const previousSnapshot = initial.snapshot;
    assert.ok(previousSnapshot);
    const expandedPreviousSnapshot: EventCacheSnapshot = {
      ...previousSnapshot,
      events: [
        ...previousSnapshot.events,
        { ...previousSnapshot.events[0], id: "event_previous_two" },
        { ...previousSnapshot.events[1], id: "event_previous_three" },
      ],
    };
    const result = await refreshCnpEvents({
      cachePath,
      context,
      httpClient: fixtureClient({
        [cnpRepertoireUrl]: '<a href="/hamlet/">Hamlet</a>',
        "https://cnp.me/hamlet/": await fixture("cnp-theatre.html"),
      }),
      now: fixedNow,
      previousSnapshot: expandedPreviousSnapshot,
    });

    assert.equal(result.success, true);
    assert.equal(result.zeroResultProtectionTriggered, false);
    assert.equal(result.diagnostics?.previousSuccessfulEventCount, 5);
    assert.equal(result.diagnostics?.finalEventCount, 1);
    assert.equal(result.diagnostics?.countDropWarning, true);
    assert.equal((await readEventCacheSnapshot(cachePath))?.events.length, 1);
  });
});

test("retains an existing cache after HTTP or cache-write failures and fails safely without one", async () => {
  await withTemporaryCache(async (cachePath) => {
    const initial = await refreshCnpEvents({
      cachePath,
      context,
      httpClient: fixtureClient(await standardPages()),
      now: fixedNow,
    });
    const previousSnapshot = initial.snapshot;
    assert.ok(previousSnapshot);
    const failingClient: CnpHttpClient = {
      get: async () => {
        throw new CnpFetchError("cnp-request-timeout", "CNP request timed out.");
      },
    };

    const retained = await refreshCnpEvents({
      cachePath,
      context,
      httpClient: failingClient,
      now: fixedNow,
      previousSnapshot,
    });
    assert.equal(retained.classification, "retained");
    assert.equal(retained.errorCode, "cnp-request-timeout");
    assert.equal((await readEventCacheSnapshot(cachePath))?.events.length, 3);

    const writeFailure = await refreshCnpEvents({
      cachePath,
      context,
      httpClient: fixtureClient(await standardPages()),
      now: fixedNow,
      previousSnapshot,
      writeCache: async () => {
        throw new Error("write failed");
      },
    });
    assert.equal(writeFailure.classification, "retained");
    assert.equal(writeFailure.errorCode, "cnp-cache-write-failed");
    assert.equal((await readEventCacheSnapshot(cachePath))?.events.length, 3);

    const unavailable = await refreshCnpEvents({
      cachePath,
      context,
      httpClient: failingClient,
      now: fixedNow,
    });
    assert.equal(unavailable.classification, "failed");
    assert.equal(unavailable.snapshot, null);
    assert.equal(unavailable.errorCode, "cnp-request-timeout");
  });
});

test("formats collector diagnostics and uses a non-zero exit code only when no cache is usable", async () => {
  const freshResult: CnpRefreshResult = {
    cachePath: "/tmp/cnp-events.json",
    classification: "fresh",
    detailPagesRequested: 3,
    refreshedAt: "2026-07-17T10:00:00.000Z",
    retainedPreviousSnapshot: false,
    snapshot: null,
    success: true,
    zeroResultProtectionTriggered: false,
  };
  const output: string[] = [];
  const fresh = await runCnpCollector({
    refresh: async () => freshResult,
    writeOutput: (line) => output.push(line),
  });
  assert.equal(fresh.exitCode, 0);
  assert.equal(JSON.parse(output[0]).status, "fresh");

  const unavailable = await runCnpCollector({
    refresh: async () => ({
      ...freshResult,
      classification: "failed",
      errorCode: "cnp-request-failed",
      lastRefreshError: "CNP request failed.",
      success: false,
    }),
    writeOutput: () => undefined,
  });
  assert.equal(unavailable.exitCode, 1);
  assert.equal(unavailable.summary.status, "unavailable");
});
