import { env } from "../../../config/env.ts";
import { readEventCache } from "./events-cache.ts";
import { isCitySupportedByProvider } from "@/shared/config/cities";
import type { EventProvider } from "../domain/event.ts";

const kicProviderMetadata = {
  cachePath: ".runtime/cache/kic-events.json",
  displayName: "KIC Budo Tomović events",
  enabled: true,
  id: "kic-budo-tomovic",
  officialSource: "https://kic.podgorica.me/novosti",
  providerMode: "live",
  refreshIntervalMinutes: 180,
  sourceUrl: "https://kic.podgorica.me/novosti",
  supportedCityIds: ["podgorica"],
  supportsMultipleCities: false,
} as const;

const kicEventProvider: EventProvider = {
  async getCachedEvents(context) {
    if (
      !env.ENABLE_EVENTS ||
      env.EVENT_PROVIDER_MODE !== "live" ||
      !isCitySupportedByProvider(context.city, kicProviderMetadata.supportedCityIds)
    ) {
      return { events: [], parserWarnings: [], state: "disabled", venues: [] };
    }
    return readEventCache(env.KIC_EVENT_CACHE_PATH, env.EVENT_CACHE_FRESHNESS_MINUTES);
  },
  metadata: kicProviderMetadata,
};

export { kicEventProvider, kicProviderMetadata };
