import { acquireEventRefreshLock } from "./events-refresh-lock.ts";

interface EventRefreshProviderSummary {
  acceptedCount: number;
  durationMs: number;
  id: string;
  retainedPreviousSnapshot: boolean;
  state: "failed" | "retained" | "success";
}

interface EventRefreshSummary {
  completedAt: string;
  providers: EventRefreshProviderSummary[];
  startedAt: string;
  state: "already-running" | "failure" | "partial" | "success";
}

interface EventRefreshProviderResult {
  events?: unknown[];
  retainedPreviousSnapshot?: boolean;
  success?: boolean;
}

interface EventRefreshProvider {
  id: string;
  refresh: () => Promise<EventRefreshProviderResult>;
}

interface EventRefreshDependencies {
  cacheDirectory: string;
  now?: () => Date;
  providers: readonly EventRefreshProvider[];
}

async function runEventRefresh({
  cacheDirectory,
  now = () => new Date(),
  providers,
}: EventRefreshDependencies): Promise<EventRefreshSummary> {
  const startedAt = now().toISOString();
  const lock = await acquireEventRefreshLock(cacheDirectory, now());
  if (!("release" in lock)) {
    return { completedAt: now().toISOString(), providers: [], startedAt, state: lock.state };
  }
  try {
    const summaries: EventRefreshProviderSummary[] = [];
    for (const provider of providers) {
      const started = Date.now();
      try {
        const result = await provider.refresh();
        const retainedPreviousSnapshot = result.retainedPreviousSnapshot === true;
        const success = result.success ?? true;
        summaries.push({
          acceptedCount: Array.isArray(result.events) ? result.events.length : 0,
          durationMs: Date.now() - started,
          id: provider.id,
          retainedPreviousSnapshot,
          state: success ? "success" : retainedPreviousSnapshot ? "retained" : "failed",
        });
      } catch {
        summaries.push({
          acceptedCount: 0,
          durationMs: Date.now() - started,
          id: provider.id,
          retainedPreviousSnapshot: false,
          state: "failed",
        });
      }
    }
    return {
      completedAt: now().toISOString(),
      providers: summaries,
      startedAt,
      state: summaries.every(({ state }) => state !== "failed") ? "success" : "partial",
    };
  } finally {
    await lock.release();
  }
}

export {
  runEventRefresh,
  type EventRefreshDependencies,
  type EventRefreshProvider,
  type EventRefreshProviderSummary,
  type EventRefreshSummary,
};
