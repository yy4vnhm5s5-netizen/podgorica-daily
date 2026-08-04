type CityAlertsRefreshProviderId = "cedis" | "vik-ulcinj" | "vikpg" | "vodovod-kotor";
type CityAlertsRefreshProviderState = "already-running" | "failed" | "retained" | "success";
type CityAlertsRefreshCacheStatus = "fresh" | "stale" | "unavailable";

// Structurally identical to VikpgFetchDiagnostics (modules/city-alerts/infrastructure/
// vikpg-refresh.ts), defined independently here so this shared, CEDIS-and-VIKPG runner never
// imports a provider-specific module. Every field is optional and already sanitized by whichever
// provider supplies it (bounded body preview, host+path-only URL, no headers/cookies/stack) — the
// runner only ever forwards this object unchanged, never reads or adds to it.
interface CityAlertsProviderDiagnostics {
  readonly emptyBody?: boolean;
  readonly finalUrl?: string;
  readonly httpStatus?: number;
  readonly networkErrorType?: string;
  readonly redirected?: boolean;
  readonly responseBodyPreview?: string;
}

interface CityAlertsRefreshProviderSummary {
  alertCount: number;
  attempted: true;
  cacheStatus: CityAlertsRefreshCacheStatus;
  diagnostics?: CityAlertsProviderDiagnostics;
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
      diagnostics?: CityAlertsProviderDiagnostics;
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
          // Forwarded exactly as the provider prepared it — already sanitized/bounded at the
          // source (see vikpg-http-client.ts); this runner never inspects or re-shapes it.
          ...(summary.diagnostics ? { diagnostics: summary.diagnostics } : {}),
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
  type CityAlertsProviderDiagnostics,
  type CityAlertsRefreshCacheStatus,
  type CityAlertsRefreshProvider,
  type CityAlertsRefreshProviderSummary,
  type CityAlertsRefreshSummary,
};
