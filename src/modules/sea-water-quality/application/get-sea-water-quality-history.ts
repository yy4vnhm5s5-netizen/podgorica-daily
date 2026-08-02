import { supportsCityCapability } from "@/shared/config/cities";
import type { CityContext } from "@/shared/types/city";

import type { SeaWaterQualityHistoryLocation } from "../domain/sea-water-quality.ts";
import {
  getCachedSeaWaterQualityHistory,
  getSeaWaterQualityHistoryCachePath,
  type SeaWaterQualityHistoryCacheResult,
} from "../infrastructure/sea-water-quality-history-cache.ts";
import { getSeaWaterQualityCityId } from "../infrastructure/sea-water-quality-cities.ts";

function canReadSeaWaterQualityHistory(context: CityContext) {
  return (
    supportsCityCapability(context.city, "seaWaterQuality") &&
    getSeaWaterQualityCityId(context) !== undefined
  );
}

async function getSeaWaterQualityHistory(
  context: CityContext,
): Promise<SeaWaterQualityHistoryCacheResult> {
  const cityId = canReadSeaWaterQualityHistory(context)
    ? getSeaWaterQualityCityId(context)
    : undefined;
  if (!cityId) return { state: "unavailable" };

  return getCachedSeaWaterQualityHistory(getSeaWaterQualityHistoryCachePath(cityId));
}

async function getSeaWaterQualityLocationBySlug(
  context: CityContext,
  slug: string,
): Promise<{
  location?: SeaWaterQualityHistoryLocation;
  result: SeaWaterQualityHistoryCacheResult;
}> {
  const result = await getSeaWaterQualityHistory(context);
  return {
    ...(result.history
      ? { location: result.history.locations.find((location) => location.canonicalSlug === slug) }
      : {}),
    result,
  };
}

async function getSeaWaterQualityLocationSlugs(context: CityContext) {
  const result = await getSeaWaterQualityHistory(context);
  return new Map(
    result.history?.locations.map((location) => [
      location.sourceLocationId,
      location.canonicalSlug,
    ]) ?? [],
  );
}

export {
  canReadSeaWaterQualityHistory,
  getSeaWaterQualityHistory,
  getSeaWaterQualityLocationBySlug,
  getSeaWaterQualityLocationSlugs,
};
