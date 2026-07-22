import { supportsCityCapability } from "@/shared/config/cities";
import type { CityContext } from "@/shared/types/city";

import {
  getCachedMonteGigsGoingOut,
  type GoingOutCacheResult,
} from "../infrastructure/montegigs-going-out.ts";

function canReadGoingOutEvents(context: CityContext) {
  return supportsCityCapability(context.city, "goingOut");
}

async function getGoingOutEvents(context: CityContext): Promise<GoingOutCacheResult> {
  if (!canReadGoingOutEvents(context)) {
    return { events: [], state: "unavailable" };
  }

  return getCachedMonteGigsGoingOut();
}

export { canReadGoingOutEvents, getGoingOutEvents };
