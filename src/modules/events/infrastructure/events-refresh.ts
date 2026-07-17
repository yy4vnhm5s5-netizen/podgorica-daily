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
      refresh: () =>
        refreshKicEvents({
          cachePath: env.KIC_EVENT_CACHE_PATH,
          context,
          httpClient: createKicHttpClient(),
        }),
    },
    {
      id: "cnp",
      refresh: async () =>
        refreshCnpEvents({
          cachePath: env.CNP_EVENT_CACHE_PATH,
          context,
          httpClient: createCnpHttpClient(),
          previousSnapshot: await readEventCacheSnapshot(env.CNP_EVENT_CACHE_PATH),
        }),
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
      refresh: () =>
        refreshTourismEvents({
          cachePath: env.TOURISM_EVENT_CACHE_PATH,
          context,
          httpClient: createTourismHttpClient(),
        }),
    },
  ];
  return runEventRefresh({ cacheDirectory: env.EVENT_CACHE_DIR, providers });
}

export { refreshAllEvents, type EventRefreshSummary };
