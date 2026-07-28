import { env } from "../../../config/env.ts";
import type { EventProvider } from "../domain/event.ts";
import { readEventCache } from "./events-cache.ts";
import { isCitySupportedByProvider } from "@/shared/config/cities";

// No dedicated TIVAT_EVENT_CACHE_PATH env var: this mirrors how every provider's cache path
// already defaults to a fixed filename under the shared EVENT_CACHE_DIR (see env.ts's
// TOURISM_EVENT_CACHE_PATH/CNP_EVENT_CACHE_PATH/etc. defaults) rather than introducing a new
// environment variable for a single-city provider.
const defaultTivatTourismEventCachePath = `${env.EVENT_CACHE_DIR}/tivat-tourism-events.json`;

const tivatTourismEventProviderMetadata = {
  cachePath: defaultTivatTourismEventCachePath,
  displayName: "Turistička organizacija Tivat events",
  enabled: true,
  id: "tourism-tivat",
  officialSource: "https://tivat.travel/dogadjaji/",
  providerMode: "live",
  refreshIntervalMinutes: 180,
  sourceUrl: "https://tivat.travel/dogadjaji/",
  supportedCityIds: ["tivat"],
  supportsMultipleCities: false,
} as const;

const tivatTourismEventProvider: EventProvider = {
  async getCachedEvents(context) {
    if (
      !env.ENABLE_EVENTS ||
      env.EVENT_PROVIDER_MODE !== "live" ||
      !isCitySupportedByProvider(context.city, tivatTourismEventProviderMetadata.supportedCityIds)
    )
      return { events: [], parserWarnings: [], state: "disabled", venues: [] };
    return readEventCache(defaultTivatTourismEventCachePath, env.EVENT_CACHE_FRESHNESS_MINUTES);
  },
  metadata: tivatTourismEventProviderMetadata,
};
export {
  defaultTivatTourismEventCachePath,
  tivatTourismEventProvider,
  tivatTourismEventProviderMetadata,
};
