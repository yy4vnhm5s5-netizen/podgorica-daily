import { env } from "@/config/env";
import { supportsCityCapability } from "@/shared/config/cities";
import type { CityContext } from "@/shared/types/city";

import {
  getCachedPodgoricaFlights,
  type PodgoricaFlightsCacheResult,
} from "../infrastructure/podgorica-flights.ts";

function canReadPodgoricaFlights(context: CityContext) {
  return supportsCityCapability(context.city, "flights");
}

async function getPodgoricaFlights(context: CityContext): Promise<PodgoricaFlightsCacheResult> {
  if (!canReadPodgoricaFlights(context)) {
    return { flights: [], state: "unavailable" };
  }

  return getCachedPodgoricaFlights(env.PODGORICA_FLIGHTS_CACHE_PATH);
}

export { canReadPodgoricaFlights, getPodgoricaFlights };
