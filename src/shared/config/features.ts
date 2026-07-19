import { env } from "@/config/env";

const featureFlags = {
  airQuality: false,
  amscg: env.ENABLE_AMSCG,
  authentication: false,
  busStation: true,
  cityAlerts: true,
  cedis: env.ENABLE_CEDIS,
  dailyOverview: true,
  events: env.ENABLE_EVENTS && env.EVENT_PROVIDER_MODE !== "disabled",
  maps: false,
  search: false,
  weather: env.ENABLE_WEATHER,
} as const;

type Feature = keyof typeof featureFlags;

function isFeatureEnabled(feature: Feature) {
  return featureFlags[feature];
}

export { featureFlags, isFeatureEnabled, type Feature };
