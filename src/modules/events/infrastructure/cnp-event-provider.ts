import { env } from "../../../config/env.ts";
import type { EventProvider, EventProviderResult } from "../domain/event.ts";
import { readEventCache } from "./events-cache.ts";
import { isCitySupportedByProvider } from "@/shared/config/cities";
import type { CityContext, CityId } from "@/shared/types/city";

const cnpProviderMetadata = {
  cachePath: ".runtime/cache/cnp-events.json",
  displayName: "Crnogorsko narodno pozorište events",
  enabled: true,
  id: "cnp",
  officialSource: "https://cnp.me/repertoar/",
  providerMode: "live",
  refreshIntervalMinutes: 180,
  sourceUrl: "https://cnp.me/repertoar/",
  supportedCityIds: ["podgorica"] as readonly CityId[],
  supportsMultipleCities: false,
} as const;

type CnpProviderConfiguration = Pick<
  typeof env,
  "CNP_EVENT_CACHE_PATH" | "ENABLE_EVENTS" | "EVENT_CACHE_FRESHNESS_MINUTES" | "EVENT_PROVIDER_MODE"
>;
type CnpCacheReader = (
  cachePath: string,
  freshnessThresholdMinutes: number,
) => Promise<EventProviderResult>;

function createCnpEventProvider({
  configuration = env,
  readCache = readEventCache,
}: {
  configuration?: CnpProviderConfiguration;
  readCache?: CnpCacheReader;
} = {}): EventProvider {
  return {
    async getCachedEvents(context: CityContext) {
      if (
        !configuration.ENABLE_EVENTS ||
        configuration.EVENT_PROVIDER_MODE !== "live" ||
        !isCitySupportedByProvider(context.city, cnpProviderMetadata.supportedCityIds)
      ) {
        return { events: [], parserWarnings: [], state: "disabled", venues: [] };
      }
      return readCache(
        configuration.CNP_EVENT_CACHE_PATH,
        configuration.EVENT_CACHE_FRESHNESS_MINUTES,
      );
    },
    metadata: cnpProviderMetadata,
  };
}

const cnpEventProvider = createCnpEventProvider();

export { cnpEventProvider, cnpProviderMetadata, createCnpEventProvider };
