import { env } from "@/config/env";

const featureFlags = {
  airQuality: false,
  amscg: env.ENABLE_AMSCG,
  authentication: false,
  cityAlerts: true,
  cedis: env.ENABLE_CEDIS,
  dailyOverview: true,
  events: false,
  maps: false,
  publicTransport: false,
  search: false,
  weather: env.ENABLE_WEATHER,
} as const;

type Feature = keyof typeof featureFlags;

function isFeatureEnabled(feature: Feature) {
  return featureFlags[feature];
}

export { featureFlags, isFeatureEnabled, type Feature };
