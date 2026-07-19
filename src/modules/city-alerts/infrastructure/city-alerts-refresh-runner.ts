type CityAlertsRefreshProviderId = "cedis" | "vikpg";
type CityAlertsRefreshProviderState = "already-running" | "failed" | "retained" | "success";
type CityAlertsRefreshCacheStatus = "fresh" | "stale" | "unavailable";

interface CityAlertsRefreshProviderSummary {
  alertCount: number;
  attempted: true;
  cacheStatus: CityAlertsRefreshCacheStatus;
  errorCode?: string;
  provider: CityAlertsRefreshProviderId;
  retainedPreviousCache: boolean;
  state: CityAlertsRefreshProviderState;
  success: boolean;
  warnings: readonly string[];
}

interface CityAlertsRefreshSummary {
  completedAt: string;
  providers: CityAlertsRefreshProviderSummary[];
  startedAt: string;
  state: "already-running" | "failure" | "partial" | "success";
}

interface CityAlertsRefreshProvider {
  id: CityAlertsRefreshProviderId;
  refresh: () => Promise<{
    exitCode: 0 | 1;
    summary: {
      alertCount: number;
      cacheStatus?: CityAlertsRefreshCacheStatus;
      errorCode?: string;
      retainedPreviousSnapshot: boolean;
      status: "already-running" | "retained" | "success" | "unavailable";
      warnings?: readonly string[];
    };
  }>;
}

async function runCityAlertsRefresh({
  now = () => new Date(),
  providers,
}: {
  now?: () => Date;
  providers: readonly CityAlertsRefreshProvider[];
}): Promise<CityAlertsRefreshSummary> {
  const startedAt = now().toISOString();
  const summaries = await Promise.all(
    providers.map(async ({ id, refresh }) => {
      try {
        const { exitCode, summary } = await refresh();
        const state =
          summary.status === "already-running"
            ? "already-running"
            : exitCode === 0
              ? summary.status === "retained"
                ? "retained"
                : "success"
              : "failed";
        return {
          alertCount: summary.alertCount,
          attempted: true,
          cacheStatus:
            summary.cacheStatus ??
            (state === "retained" ? "stale" : state === "success" ? "fresh" : "unavailable"),
          ...(summary.errorCode ? { errorCode: summary.errorCode } : {}),
          provider: id,
          retainedPreviousCache: summary.retainedPreviousSnapshot,
          state,
          success: summary.status === "success",
          warnings: summary.warnings ?? [],
        } satisfies CityAlertsRefreshProviderSummary;
      } catch {
        return {
          alertCount: 0,
          attempted: true,
          cacheStatus: "unavailable",
          provider: id,
          retainedPreviousCache: false,
          state: "failed",
          success: false,
          warnings: [],
        } satisfies CityAlertsRefreshProviderSummary;
      }
    }),
  );
  return {
    completedAt: now().toISOString(),
    providers: summaries,
    startedAt,
    state: getRefreshState(summaries),
  };
}

function getRefreshState(providers: readonly CityAlertsRefreshProviderSummary[]) {
  if (providers.length > 0 && providers.every(({ state }) => state === "already-running")) {
    return "already-running" as const;
  }
  if (providers.length > 0 && providers.every(({ state }) => state === "success")) {
    return "success" as const;
  }
  if (providers.some(({ state }) => state !== "failed")) return "partial" as const;
  return "failure" as const;
}

export {
  runCityAlertsRefresh,
  type CityAlertsRefreshCacheStatus,
  type CityAlertsRefreshProvider,
  type CityAlertsRefreshProviderSummary,
  type CityAlertsRefreshSummary,
};
