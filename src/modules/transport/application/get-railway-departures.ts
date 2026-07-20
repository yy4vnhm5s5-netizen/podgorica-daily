import { env } from "@/config/env";

import { getCachedZpcgRailway } from "../infrastructure/zpcg-railway";

function getRailwayDepartures() {
  return getCachedZpcgRailway(env.ZPCG_RAILWAY_CACHE_PATH);
}

export { getRailwayDepartures };
