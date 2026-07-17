import assert from "node:assert/strict";
import { mkdtemp, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { acquireEventRefreshLock, lockFileName, staleLockMs } from "./events-refresh-lock.ts";

async function withCacheDirectory(run: (directory: string) => Promise<void>) {
  const directory = await mkdtemp(join(tmpdir(), "events-refresh-lock-"));
  try {
    await run(directory);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
}

test("acquires, rejects overlap, releases, and permits later acquisition", async () => {
  await withCacheDirectory(async (directory) => {
    const first = await acquireEventRefreshLock(directory);
    assert.equal(first.state, "acquired");
    const second = await acquireEventRefreshLock(directory);
    assert.equal(second.state, "already-running");
    if (!("release" in first)) throw new Error("expected acquired lock");
    await first.release();
    const third = await acquireEventRefreshLock(directory);
    assert.equal(third.state, "acquired");
    if ("release" in third) await third.release();
  });
});

test("creates a missing cache directory and tolerates missing lock cleanup", async () => {
  await withCacheDirectory(async (directory) => {
    const nested = join(directory, "nested", "cache");
    const lock = await acquireEventRefreshLock(nested);
    assert.equal(lock.state, "acquired");
    if (!("release" in lock)) throw new Error("expected acquired lock");
    await rm(join(nested, lockFileName), { force: true });
    await lock.release();
  });
});

test("recovers stale valid and malformed locks but preserves fresh malformed locks", async () => {
  await withCacheDirectory(async (directory) => {
    const path = join(directory, lockFileName);
    const now = new Date("2026-07-17T12:00:00.000Z");
    await writeFile(path, JSON.stringify({ acquiredAt: "2026-07-17T11:00:00.000Z" }), "utf8");
    const stale = await acquireEventRefreshLock(directory, now);
    assert.equal(stale.state, "recovered");
    if ("release" in stale) await stale.release();

    await writeFile(path, "not-json", "utf8");
    const old = new Date(now.getTime() - staleLockMs - 1_000);
    await utimes(path, old, old);
    const malformedStale = await acquireEventRefreshLock(directory, now);
    assert.equal(malformedStale.state, "recovered");
    if ("release" in malformedStale) await malformedStale.release();

    await writeFile(path, "not-json", "utf8");
    const fresh = await acquireEventRefreshLock(directory, now);
    assert.equal(fresh.state, "already-running");
  });
});

test("two concurrent acquisitions never produce two owners", async () => {
  await withCacheDirectory(async (directory) => {
    const results = await Promise.all([
      acquireEventRefreshLock(directory),
      acquireEventRefreshLock(directory),
    ]);
    assert.equal(results.filter((result) => "release" in result).length, 1);
    await Promise.all(
      results
        .filter((result) => "release" in result)
        .map((result) => (result as { release: () => Promise<void> }).release()),
    );
  });
});
