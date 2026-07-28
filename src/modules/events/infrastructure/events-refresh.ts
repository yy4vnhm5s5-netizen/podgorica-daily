import { getDefaultCityContext } from "../../../config/city-context.ts";
import { getEventQualityPolicy } from "../../../config/event-quality.ts";
import { env } from "../../../config/env.ts";
import { createCityContext } from "@/shared/config/cities";
import { createCnpHttpClient } from "./cnp-http-client.ts";
import { createCineplexxBrowserRenderer } from "./cineplexx-browser-renderer.ts";
import { refreshCineplexxProgramme } from "./cineplexx-refresh.ts";
import { emitInfo } from "./event-refresh-logger.ts";
import { refreshCnpEvents } from "./cnp-refresh.ts";
import { readEventCacheSnapshot } from "./events-cache.ts";
import {
  runEventRefresh,
  type EventRefreshProvider,
  type EventRefreshSummary,
} from "./events-refresh-runner.ts";
import { createGlavniGradHttpClient } from "./glavni-grad-http-client.ts";
import { refreshGlavniGradEvents } from "./glavni-grad-refresh.ts";
import { createTivatTourismHttpClient } from "./tivat-tourism-http-client.ts";
import { defaultTivatTourismEventCachePath } from "./tivat-tourism-event-provider.ts";
import { refreshTivatTourismEvents } from "./tivat-tourism-refresh.ts";
import { createTourismHttpClient } from "./tourism-http-client.ts";
import { refreshTourismEvents } from "./tourism-refresh.ts";

async function refreshAllEvents(): Promise<EventRefreshSummary> {
  const context = getDefaultCityContext();
  return refreshEventProviders([
    createCineplexxRefreshProvider(context),
    ...createStandardEventRefreshProviders(context),
    createTivatTourismRefreshProvider(),
  ]);
}

async function refreshStandardEvents(): Promise<EventRefreshSummary> {
  return refreshEventProviders([
    ...createStandardEventRefreshProviders(getDefaultCityContext()),
    createTivatTourismRefreshProvider(),
  ]);
}

async function refreshCineplexxEvents(): Promise<EventRefreshSummary> {
  return refreshEventProviders([createCineplexxRefreshProvider(getDefaultCityContext())]);
}

function createStandardEventRefreshProviders(
  context: ReturnType<typeof getDefaultCityContext>,
): EventRefreshProvider[] {
  return [
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
}

// Tivat's Tourism provider is not part of createStandardEventRefreshProviders because that
// function's providers all deliberately share one Podgorica context — Tivat needs its own city
// context and its own (env-var-free, EVENT_CACHE_DIR-derived) cache path instead.
function createTivatTourismRefreshProvider(): EventRefreshProvider {
  return {
    id: "tourism-tivat",
    refresh: async () => {
      const result = await refreshTivatTourismEvents({
        cachePath: defaultTivatTourismEventCachePath,
        context: createCityContext("tivat"),
        httpClient: createTivatTourismHttpClient(),
      });
      return {
        acceptedCount: result.snapshot?.events.length ?? 0,
        retainedPreviousSnapshot: result.retainedPreviousSnapshot,
        success: result.success,
      };
    },
  };
}

function createCineplexxRefreshProvider(
  context: ReturnType<typeof getDefaultCityContext>,
): EventRefreshProvider {
  return {
    id: "cineplexx-podgorica",
    refresh: async () => {
      const result = await refreshCineplexxProgramme({
        cachePath: env.CINEPLEXX_EVENT_CACHE_PATH,
        context,
        previousSnapshot: await readEventCacheSnapshot(env.CINEPLEXX_EVENT_CACHE_PATH),
        qualityPolicy: getEventQualityPolicy(),
        renderer: createCineplexxBrowserRenderer({ chromiumPath: env.CHROMIUM_PATH }),
      });
      return {
        acceptedCount: result.snapshot?.events.length ?? 0,
        retainedPreviousSnapshot: result.retainedPreviousSnapshot,
        success: result.success,
      };
    },
  };
}

async function refreshEventProviders(
  providers: EventRefreshProvider[],
): Promise<EventRefreshSummary> {
  emitInfo({
    event: "events-refresh-started",
    providers: providers.map(({ id }) => id),
  });
  const summary = await runEventRefresh({ cacheDirectory: env.EVENT_CACHE_DIR, providers });
  logEventRefreshSummary(summary);
  return summary;
}

function logEventRefreshSummary(summary: EventRefreshSummary) {
  for (const provider of summary.providers) {
    emitInfo({
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
    });
  }
  emitInfo({
    completedAt: summary.completedAt,
    event: "events-refresh-completed",
    providerCount: summary.providers.length,
    startedAt: summary.startedAt,
    state: summary.state,
  });
}

export {
  createCineplexxRefreshProvider,
  createStandardEventRefreshProviders,
  createTivatTourismRefreshProvider,
  refreshAllEvents,
  refreshCineplexxEvents,
  refreshStandardEvents,
  type EventRefreshSummary,
};
