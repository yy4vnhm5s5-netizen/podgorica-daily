import { isActiveCity, supportsCityCapability } from "./cities.ts";
import { isFeatureEnabled, type Feature } from "./features.ts";
import type { City, CityCapability } from "@/shared/types/city";

interface CityRouteAvailabilityOptions {
  isFeatureEnabled?: typeof isFeatureEnabled;
}

// Capabilities whose public route is additionally gated behind a global feature flag. A capability
// missing from this map (events, electricity, railway, water, weather) is reachable whenever the
// city declares it.
const publicFeatureByCityCapability: Partial<Record<CityCapability, Feature>> = {
  flights: "flights",
  goingOut: "goingOut",
  parking: "parking",
  seaWaterQuality: "seaWaterQuality",
};

// The single source of truth for "does this city have a reachable public route for this
// capability". It lives in the shared layer (rather than beside the route definitions in
// `src/app`) because it is pure capability + feature-flag logic with no Next.js or module
// dependency, and both the app layer (sitemap, route guards) and shared presentation components
// (contextual city navigation) must apply exactly the same rule. `src/app/city-routing.ts`
// re-exports it, so app-layer call sites keep importing it from there.
function isCityPublicFeatureRouteAvailable(
  city: City,
  capability: CityCapability,
  { isFeatureEnabled: checkFeature = isFeatureEnabled }: CityRouteAvailabilityOptions = {},
) {
  if (!isActiveCity(city) || !supportsCityCapability(city, capability)) return false;

  const feature = publicFeatureByCityCapability[capability];
  return feature ? checkFeature(feature) : true;
}

export { isCityPublicFeatureRouteAvailable, type CityRouteAvailabilityOptions };
