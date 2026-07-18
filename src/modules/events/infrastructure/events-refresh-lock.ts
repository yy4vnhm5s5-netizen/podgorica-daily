import {
  acquireRefreshLock,
  type RefreshLockResult,
} from "../../../shared/lib/refresh-lock.ts";

const lockFileName = ".events-refresh.lock";
const staleLockMs = 30 * 60_000;

type EventRefreshLockResult = RefreshLockResult;

async function acquireEventRefreshLock(
  cacheDirectory: string,
  now = new Date(),
): Promise<EventRefreshLockResult> {
  return acquireRefreshLock(cacheDirectory, { lockFileName, now, staleLockMs });
}

export { acquireEventRefreshLock, lockFileName, staleLockMs, type EventRefreshLockResult };
