import { env } from "@/config/env";
import { supportsCityCapability } from "@/shared/config/cities";
import type { CityContext } from "@/shared/types/city";

import { getCachedZpcgRailway } from "../infrastructure/zpcg-railway.ts";

type RailwayDeparturesResult = Awaited<ReturnType<typeof getCachedZpcgRailway>>;

function canReadRailwayDepartures(context: CityContext) {
  return supportsCityCapability(context.city, "railway");
}

async function getRailwayDepartures(context: CityContext): Promise<RailwayDeparturesResult> {
  if (!canReadRailwayDepartures(context)) {
    return { departures: [], state: "unavailable" };
  }

  return getCachedZpcgRailway(env.ZPCG_RAILWAY_CACHE_PATH);
}

export { canReadRailwayDepartures, getRailwayDepartures, type RailwayDeparturesResult };
