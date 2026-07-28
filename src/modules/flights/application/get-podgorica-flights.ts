import { supportsCityCapability } from "@/shared/config/cities";
import type { CityContext } from "@/shared/types/city";

import {
  getCachedPodgoricaFlights,
  getFlightsCachePath,
  isFlightsSupportedCityId,
  type PodgoricaFlightsCacheResult,
} from "../infrastructure/podgorica-flights.ts";

function canReadPodgoricaFlights(context: CityContext) {
  return supportsCityCapability(context.city, "flights");
}

async function getPodgoricaFlights(context: CityContext): Promise<PodgoricaFlightsCacheResult> {
  // Read the cache for the requesting city's own airport, not always Podgorica's — this was
  // previously hardcoded to a single fixed path regardless of which city's context was passed.
  if (!canReadPodgoricaFlights(context) || !isFlightsSupportedCityId(context.city.id)) {
    return { flights: [], state: "unavailable" };
  }

  return getCachedPodgoricaFlights(getFlightsCachePath(context.city.id));
}

export { canReadPodgoricaFlights, getPodgoricaFlights };
