const featureFlags = {
  airQuality: false,
  authentication: false,
  cityAlerts: false,
  dailyBrief: true,
  events: false,
  maps: false,
  publicTransport: false,
  search: false,
  weather: true,
} as const;

type Feature = keyof typeof featureFlags;

function isFeatureEnabled(feature: Feature) {
  return featureFlags[feature];
}

export { featureFlags, isFeatureEnabled, type Feature };
