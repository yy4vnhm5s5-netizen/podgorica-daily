import { env } from "../../../config/env.ts";
import { readEventCache } from "./events-cache.ts";
import type { EventProvider } from "../domain/event.ts";

const kicEventProvider: EventProvider = {
  async getCachedEvents(context) {
    if (!context.city.id || !env.ENABLE_EVENTS || env.EVENT_PROVIDER_MODE !== "live") {
      return { events: [], parserWarnings: [], state: "disabled", venues: [] };
    }
    return readEventCache(env.KIC_EVENT_CACHE_PATH, env.EVENT_CACHE_FRESHNESS_MINUTES);
  },
  metadata: {
    cachePath: ".runtime/cache/kic-events.json",
    displayName: "KIC Budo Tomović events",
    enabled: true,
    id: "kic-budo-tomovic",
    officialSource: "https://kic.podgorica.me/novosti",
    providerMode: "live",
    refreshIntervalMinutes: 60,
    sourceUrl: "https://kic.podgorica.me/novosti",
    supportedCityIds: ["podgorica"],
    supportsMultipleCities: false,
  },
};

export { kicEventProvider };
