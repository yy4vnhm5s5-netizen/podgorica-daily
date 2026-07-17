const featureFlags = {
  aiDailySummary: false,
  airQuality: false,
  authentication: false,
  cityAlerts: false,
  events: false,
  maps: false,
  publicTransport: false,
  search: false,
  weather: false,
} as const;

type Feature = keyof typeof featureFlags;

function isFeatureEnabled(feature: Feature) {
  return featureFlags[feature];
}

export { featureFlags, isFeatureEnabled, type Feature };
