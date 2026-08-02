import { env } from "@/config/env";
import { runActiveWeatherCollectors } from "@/modules/weather/infrastructure/collect-weather";

import { toMultiCityWeatherRefreshEndpointResult } from "../../provider-refresh-result.ts";
import { createRefreshPostHandler } from "../../refresh-post-handler.ts";

function createWeatherRefreshPostHandler({
  runActiveCollectors = runActiveWeatherCollectors,
  secret = env.WEATHER_REFRESH_SECRET,
}: {
  runActiveCollectors?: typeof runActiveWeatherCollectors;
  secret?: string;
} = {}) {
  return createRefreshPostHandler({
    refresh: async () => toMultiCityWeatherRefreshEndpointResult(await runActiveCollectors()),
    secret,
  });
}

export { createWeatherRefreshPostHandler };
