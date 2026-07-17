import { env } from "../../../config/env.ts";
import type { EventProvider } from "../domain/event.ts";
import { readEventCache } from "./events-cache.ts";
const tourismEventProvider: EventProvider = {
  async getCachedEvents(context) {
    if (!env.ENABLE_EVENTS || env.EVENT_PROVIDER_MODE !== "live" || context.city.id !== "podgorica")
      return { events: [], parserWarnings: [], state: "disabled", venues: [] };
    return readEventCache(env.TOURISM_EVENT_CACHE_PATH, env.EVENT_CACHE_FRESHNESS_MINUTES);
  },
  metadata: {
    cachePath: ".runtime/cache/tourism-events.json",
    displayName: "Turistička organizacija Podgorice events",
    enabled: true,
    id: "tourism-podgorica",
    officialSource: "https://podgorica.travel/dogadjaji-kalendar/",
    providerMode: "live",
    refreshIntervalMinutes: 60,
    sourceUrl: "https://podgorica.travel/dogadjaji-kalendar/",
    supportedCityIds: ["podgorica"],
    supportsMultipleCities: false,
  },
};
export { tourismEventProvider };
