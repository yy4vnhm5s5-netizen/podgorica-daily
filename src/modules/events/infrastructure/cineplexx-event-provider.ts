import { env } from "../../../config/env.ts";
import type { EventProvider } from "../domain/event.ts";
import { readEventCache } from "./events-cache.ts";
import { isCitySupportedByProvider } from "@/shared/config/cities";

const cineplexxEventProviderMetadata = {
  cachePath: ".runtime/cache/cineplexx-events.json",
  displayName: "Cineplexx Podgorica programme",
  enabled: true,
  id: "cineplexx-podgorica",
  officialSource: "https://www.cineplexx.me/cinemas/CINEPLEXX-PODGORICA/",
  providerMode: "live",
  refreshIntervalMinutes: 720,
  sourceUrl: "https://www.cineplexx.me/cinemas/CINEPLEXX-PODGORICA/",
  supportedCityIds: ["podgorica"],
  supportsMultipleCities: false,
} as const;

const cineplexxEventProvider: EventProvider = {
  async getCachedEvents(context) {
    if (
      !env.ENABLE_EVENTS ||
      env.EVENT_PROVIDER_MODE !== "live" ||
      !isCitySupportedByProvider(context.city, cineplexxEventProviderMetadata.supportedCityIds)
    )
      return { events: [], parserWarnings: [], state: "disabled", venues: [] };
    return readEventCache(env.CINEPLEXX_EVENT_CACHE_PATH, env.CINEPLEXX_CACHE_FRESHNESS_MINUTES);
  },
  metadata: cineplexxEventProviderMetadata,
};

export { cineplexxEventProvider, cineplexxEventProviderMetadata };
