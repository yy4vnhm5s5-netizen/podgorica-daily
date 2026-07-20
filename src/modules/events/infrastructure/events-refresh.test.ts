import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { lockFileName, staleLockMs } from "./events-refresh-lock.ts";
import { runEventRefresh, type EventRefreshProvider } from "./events-refresh-runner.ts";

async function withCacheDirectory(run: (directory: string) => Promise<void>) {
  const directory = await mkdtemp(join(tmpdir(), "events-refresh-"));
  try {
    await run(directory);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
}

function provider(id: string, refresh: EventRefreshProvider["refresh"]): EventRefreshProvider {
  return { id, refresh };
}

test("runs every provider in order and preserves accepted counts and retained cache state", async () => {
  await withCacheDirectory(async (cacheDirectory) => {
    const calls: string[] = [];
    const summary = await runEventRefresh({
      cacheDirectory,
      providers: [
        provider("first", async () => {
          calls.push("first");
          return { events: [{}, {}] };
        }),
        provider("retained", async () => {
          calls.push("retained");
          return { events: [{}], retainedPreviousSnapshot: true, success: false };
        }),
        provider("last", async () => {
          calls.push("last");
          return { events: [{}] };
        }),
      ],
    });
    assert.deepEqual(calls, ["first", "retained", "last"]);
    assert.equal(summary.state, "success");
    assert.deepEqual(
      summary.providers.map(({ acceptedCount, id, retainedPreviousSnapshot, state }) => ({
        acceptedCount,
        id,
        retainedPreviousSnapshot,
        state,
      })),
      [
        { acceptedCount: 2, id: "first", retainedPreviousSnapshot: false, state: "success" },
        { acceptedCount: 1, id: "retained", retainedPreviousSnapshot: true, state: "retained" },
        { acceptedCount: 1, id: "last", retainedPreviousSnapshot: false, state: "success" },
      ],
    );
    assert.ok(summary.providers.every(({ durationMs }) => durationMs >= 0));
    assert.equal(JSON.stringify(summary).includes("/private/"), false);
  });
});

test("uses an explicit accepted count for providers that return a cache snapshot wrapper", async () => {
  await withCacheDirectory(async (cacheDirectory) => {
    const summary = await runEventRefresh({
      cacheDirectory,
      providers: [
        provider("snapshot-provider", async () => ({
          acceptedCount: 3,
          events: [],
          success: true,
        })),
      ],
    });

    assert.equal(summary.providers[0].acceptedCount, 3);
  });
});

test("classifies all-success and all-failure runs without leaking provider errors", async () => {
  await withCacheDirectory(async (cacheDirectory) => {
    const success = await runEventRefresh({
      cacheDirectory,
      providers: [provider("one", async () => ({ events: [] }))],
    });
    assert.equal(success.state, "success");
    const failure = await runEventRefresh({
      cacheDirectory,
      providers: [
        provider("one", async () => {
          throw new Error("secret /private/tmp/raw.html full description");
        }),
      ],
    });
    assert.equal(failure.state, "partial");
    assert.equal(failure.providers[0].state, "failed");
    assert.equal(JSON.stringify(failure).includes("secret"), false);
  });
});

test("active overlap executes zero providers, stale recovery runs, and locks are released after completion", async () => {
  await withCacheDirectory(async (cacheDirectory) => {
    let calls = 0;
    const activeLock = join(cacheDirectory, lockFileName);
    await writeFile(activeLock, JSON.stringify({ acquiredAt: new Date().toISOString() }));
    const blocked = await runEventRefresh({
      cacheDirectory,
      providers: [provider("blocked", async () => ({ events: [], calls: ++calls }))],
    });
    assert.equal(blocked.state, "already-running");
    assert.equal(calls, 0);
    const old = new Date(Date.now() - staleLockMs - 1_000).toISOString();
    await writeFile(activeLock, JSON.stringify({ acquiredAt: old }));
    assert.equal(
      (
        await runEventRefresh({
          cacheDirectory,
          providers: [provider("recovered", async () => ({ events: [] }))],
        })
      ).state,
      "success",
    );
    assert.equal(
      (
        await runEventRefresh({
          cacheDirectory,
          providers: [provider("after", async () => ({ events: [] }))],
        })
      ).state,
      "success",
    );
  });
});
