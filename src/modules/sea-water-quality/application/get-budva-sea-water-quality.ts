import { supportsCityCapability } from "@/shared/config/cities";
import type { CityContext } from "@/shared/types/city";

import {
  getCachedBudvaSeaWaterQuality,
  getSeaWaterQualityCachePath,
  type BudvaSeaWaterQualityCacheResult,
} from "../infrastructure/budva-sea-water-quality-cache.ts";
import { getSeaWaterQualityCityId } from "../infrastructure/sea-water-quality-cities.ts";

// Both checks matter: the city registry's capability flag gates public visibility, while
// getSeaWaterQualityCityId confirms the Morsko dobro source is actually wired for this city
// (see sea-water-quality-cities.ts). A city could in principle get the capability flag before a
// provider entry exists for it — without this second check, canReadBudvaSeaWaterQuality would
// return true, and the cache path resolution below would throw the "!" assertion instead of
// failing gracefully.
function canReadBudvaSeaWaterQuality(context: CityContext) {
  return (
    supportsCityCapability(context.city, "seaWaterQuality") &&
    getSeaWaterQualityCityId(context) !== undefined
  );
}

async function getBudvaSeaWaterQuality(
  context: CityContext,
): Promise<BudvaSeaWaterQualityCacheResult> {
  const cityId = canReadBudvaSeaWaterQuality(context)
    ? getSeaWaterQualityCityId(context)
    : undefined;
  if (!cityId) {
    return { state: "unavailable" };
  }

  return getCachedBudvaSeaWaterQuality(getSeaWaterQualityCachePath(cityId));
}

export {
  canReadBudvaSeaWaterQuality,
  getBudvaSeaWaterQuality,
  type BudvaSeaWaterQualityCacheResult,
};
