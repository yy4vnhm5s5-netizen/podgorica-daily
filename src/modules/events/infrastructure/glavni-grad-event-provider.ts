import { env } from "../../../config/env.ts";
import type { EventProvider } from "../domain/event.ts";
import { readEventCache } from "./events-cache.ts";
import { isCitySupportedByProvider } from "@/shared/config/cities";

const glavniGradEventProviderMetadata = {
  cachePath: ".runtime/cache/glavni-grad-events.json",
  displayName: "Glavni grad Podgorica events",
  enabled: true,
  id: "glavni-grad-podgorica",
  officialSource: "https://podgorica.me/category/aktuelni-dogadjaji/",
  providerMode: "live",
  refreshIntervalMinutes: 180,
  sourceUrl: "https://podgorica.me/category/aktuelni-dogadjaji/",
  supportedCityIds: ["podgorica"],
  supportsMultipleCities: false,
} as const;

const glavniGradEventProvider: EventProvider = {
  async getCachedEvents(context) {
    if (
      !env.ENABLE_EVENTS ||
      env.EVENT_PROVIDER_MODE !== "live" ||
      !isCitySupportedByProvider(context.city, glavniGradEventProviderMetadata.supportedCityIds)
    ) {
      return { events: [], parserWarnings: [], state: "disabled", venues: [] };
    }
    return readEventCache(env.GLAVNI_GRAD_EVENT_CACHE_PATH, env.EVENT_CACHE_FRESHNESS_MINUTES);
  },
  metadata: glavniGradEventProviderMetadata,
};

export { glavniGradEventProvider, glavniGradEventProviderMetadata };
