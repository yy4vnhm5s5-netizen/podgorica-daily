import { getDefaultCityContext } from "../../../config/city-context.ts";
import { env } from "../../../config/env.ts";
import { createCnpHttpClient } from "./cnp-http-client.ts";
import { refreshCnpEvents } from "./cnp-refresh.ts";
import { readEventCacheSnapshot } from "./events-cache.ts";
import {
  runEventRefresh,
  type EventRefreshProvider,
  type EventRefreshSummary,
} from "./events-refresh-runner.ts";
import { createGlavniGradHttpClient } from "./glavni-grad-http-client.ts";
import { refreshGlavniGradEvents } from "./glavni-grad-refresh.ts";
import { createKicHttpClient } from "./kic-http-client.ts";
import { refreshKicEvents } from "./kic-refresh.ts";
import { createTourismHttpClient } from "./tourism-http-client.ts";
import { refreshTourismEvents } from "./tourism-refresh.ts";

async function refreshAllEvents(): Promise<EventRefreshSummary> {
  const context = getDefaultCityContext();
  const providers: EventRefreshProvider[] = [
    {
      id: "kic",
      refresh: async () => {
        try {
          return await refreshKicEvents({
            cachePath: env.KIC_EVENT_CACHE_PATH,
            context,
            httpClient: createKicHttpClient(),
          });
        } catch (error) {
          logKicRefreshFailure(error);
          throw error;
        }
      },
    },
    {
      id: "cnp",
      refresh: async () => {
        const result = await refreshCnpEvents({
          cachePath: env.CNP_EVENT_CACHE_PATH,
          context,
          httpClient: createCnpHttpClient(),
          previousSnapshot: await readEventCacheSnapshot(env.CNP_EVENT_CACHE_PATH),
        });
        return {
          acceptedCount: result.snapshot?.events.length ?? 0,
          retainedPreviousSnapshot: result.retainedPreviousSnapshot,
          success: result.success,
        };
      },
    },
    {
      id: "glavni-grad-podgorica",
      refresh: () =>
        refreshGlavniGradEvents({
          cachePath: env.GLAVNI_GRAD_EVENT_CACHE_PATH,
          context,
          httpClient: createGlavniGradHttpClient(),
        }),
    },
    {
      id: "tourism-podgorica",
      refresh: async () => {
        const result = await refreshTourismEvents({
          cachePath: env.TOURISM_EVENT_CACHE_PATH,
          context,
          httpClient: createTourismHttpClient(),
        });
        return {
          acceptedCount: result.snapshot?.events.length ?? 0,
          retainedPreviousSnapshot: result.retainedPreviousSnapshot,
          success: result.success,
        };
      },
    },
  ];
  console.info(
    JSON.stringify({
      event: "events-refresh-started",
      providers: providers.map(({ id }) => id),
    }),
  );
  const summary = await runEventRefresh({ cacheDirectory: env.EVENT_CACHE_DIR, providers });
  logEventRefreshSummary(summary);
  return summary;
}

function logEventRefreshSummary(summary: EventRefreshSummary) {
  for (const provider of summary.providers) {
    console.info(
      JSON.stringify({
        acceptedCount: provider.acceptedCount,
        cacheOutcome: provider.retainedPreviousSnapshot
          ? "retained"
          : provider.state === "success"
            ? "written"
            : "unavailable",
        durationMs: provider.durationMs,
        event: "events-refresh-provider-completed",
        provider: provider.id,
        state: provider.state,
      }),
    );
  }
  console.info(
    JSON.stringify({
      completedAt: summary.completedAt,
      event: "events-refresh-completed",
      providerCount: summary.providers.length,
      startedAt: summary.startedAt,
      state: summary.state,
    }),
  );
}

function logKicRefreshFailure(error: unknown) {
  const exception = error instanceof Error ? error : new Error(String(error));
  console.error(
    JSON.stringify({
      error: {
        message: exception.message,
        name: exception.name,
        stack: exception.stack ?? `${exception.name}: ${exception.message}`,
      },
      event: "events-refresh-provider-failed",
      provider: "kic",
    }),
  );
}

export { refreshAllEvents, type EventRefreshSummary };
