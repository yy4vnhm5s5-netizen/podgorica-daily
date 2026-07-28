import { env } from "@/config/env";
import { supportsCityCapability } from "@/shared/config/cities";
import type { CityContext } from "@/shared/types/city";

import {
  getCachedBudvaSeaWaterQuality,
  type BudvaSeaWaterQualityCacheResult,
} from "../infrastructure/budva-sea-water-quality-cache.ts";

function canReadBudvaSeaWaterQuality(context: CityContext) {
  return supportsCityCapability(context.city, "seaWaterQuality");
}

async function getBudvaSeaWaterQuality(
  context: CityContext,
): Promise<BudvaSeaWaterQualityCacheResult> {
  if (!canReadBudvaSeaWaterQuality(context)) {
    return { state: "unavailable" };
  }

  return getCachedBudvaSeaWaterQuality(env.SEA_WATER_QUALITY_CACHE_PATH);
}

export { canReadBudvaSeaWaterQuality, getBudvaSeaWaterQuality };
