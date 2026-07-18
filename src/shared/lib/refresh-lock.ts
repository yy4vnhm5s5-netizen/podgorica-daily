import { mkdir, open, readFile, stat, unlink } from "node:fs/promises";
import { join } from "node:path";

type RefreshLockResult =
  | { release: () => Promise<void>; state: "acquired" | "recovered" }
  | { state: "already-running" | "failure" };

interface RefreshLockOptions {
  lockFileName: string;
  now?: Date;
  staleLockMs?: number;
}

async function acquireRefreshLock(
  directory: string,
  { lockFileName, now = new Date(), staleLockMs = 30 * 60_000 }: RefreshLockOptions,
): Promise<RefreshLockResult> {
  const path = join(directory, lockFileName);
  const metadata = JSON.stringify({ acquiredAt: now.toISOString(), pid: process.pid, version: 1 });

  try {
    await mkdir(directory, { recursive: true });
    const handle = await open(path, "wx");
    await handle.writeFile(metadata, "utf8");
    await handle.close();
    return { release: () => unlink(path).catch(() => undefined), state: "acquired" };
  } catch (error) {
    if (!isAlreadyExists(error)) return { state: "failure" };
  }

  if (!(await isStaleLock(path, now, staleLockMs))) return { state: "already-running" };
  await unlink(path).catch(() => undefined);

  try {
    const handle = await open(path, "wx");
    await handle.writeFile(metadata, "utf8");
    await handle.close();
    return { release: () => unlink(path).catch(() => undefined), state: "recovered" };
  } catch {
    return { state: "already-running" };
  }
}

async function isStaleLock(path: string, now: Date, staleLockMs: number) {
  try {
    const contents = await readFile(path, "utf8");
    const acquiredAt = JSON.parse(contents).acquiredAt;
    const timestamp = typeof acquiredAt === "string" ? new Date(acquiredAt).getTime() : Number.NaN;
    if (!Number.isNaN(timestamp)) return now.getTime() - timestamp > staleLockMs;
    return now.getTime() - (await stat(path)).mtime.getTime() > staleLockMs;
  } catch {
    try {
      return now.getTime() - (await stat(path)).mtime.getTime() > staleLockMs;
    } catch {
      return false;
    }
  }
}

function isAlreadyExists(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "EEXIST";
}

export { acquireRefreshLock, type RefreshLockOptions, type RefreshLockResult };
