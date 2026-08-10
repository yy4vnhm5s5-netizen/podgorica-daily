import { supportsCityCapability } from "@/shared/config/cities";
import type { CityContext } from "@/shared/types/city";

import {
  getCachedAirportFlights,
  getFlightsCachePath,
  isFlightsSupportedCityId,
  type AirportFlightsCacheResult,
} from "../infrastructure/podgorica-flights.ts";

function canReadAirportFlights(context: CityContext) {
  return supportsCityCapability(context.city, "flights");
}

async function getAirportFlights(context: CityContext): Promise<AirportFlightsCacheResult> {
  // Read the cache for the requesting city's own airport, not always Podgorica's — this was
  // previously hardcoded to a single fixed path regardless of which city's context was passed.
  if (!canReadAirportFlights(context) || !isFlightsSupportedCityId(context.city.id)) {
    return { flights: [], state: "unavailable" };
  }

  return getCachedAirportFlights(getFlightsCachePath(context.city.id));
}

export { canReadAirportFlights, getAirportFlights };
