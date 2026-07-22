import { env } from "@/config/env";

import { getCachedPodgoricaFlights } from "../infrastructure/podgorica-flights";

function getPodgoricaFlights() {
  return getCachedPodgoricaFlights(env.PODGORICA_FLIGHTS_CACHE_PATH);
}

export { getPodgoricaFlights };
