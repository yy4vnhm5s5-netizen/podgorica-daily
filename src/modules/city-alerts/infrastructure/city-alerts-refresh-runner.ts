type CityAlertsRefreshProviderId = "cedis" | "vikpg";
type CityAlertsRefreshProviderState = "already-running" | "failed" | "retained" | "success";

interface CityAlertsRefreshProviderSummary {
  alertCount: number;
  id: CityAlertsRefreshProviderId;
  retainedPreviousSnapshot: boolean;
  state: CityAlertsRefreshProviderState;
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
      retainedPreviousSnapshot: boolean;
      status: "already-running" | "retained" | "success" | "unavailable";
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
        return {
          alertCount: summary.alertCount,
          id,
          retainedPreviousSnapshot: summary.retainedPreviousSnapshot,
          state:
            summary.status === "already-running"
              ? "already-running"
              : exitCode === 0
                ? summary.status === "retained"
                  ? "retained"
                  : "success"
                : "failed",
        } satisfies CityAlertsRefreshProviderSummary;
      } catch {
        return {
          alertCount: 0,
          id,
          retainedPreviousSnapshot: false,
          state: "failed",
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
  if (providers.length > 0 && providers.every(({ state }) => state !== "failed")) {
    return "success" as const;
  }
  if (providers.some(({ state }) => state !== "failed")) return "partial" as const;
  return "failure" as const;
}

export {
  runCityAlertsRefresh,
  type CityAlertsRefreshProvider,
  type CityAlertsRefreshProviderSummary,
  type CityAlertsRefreshSummary,
};
