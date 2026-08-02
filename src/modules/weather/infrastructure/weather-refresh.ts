import type { CityContext } from "@/shared/types/city";

import {
  createOpenMeteoWeatherClient,
  type OpenMeteoCurrentWeather,
} from "./open-meteo-weather-client.ts";
import {
  getWeatherCachePath,
  readWeatherCache,
  toWeatherSnapshotWeather,
  weatherSourceUrl,
  writeWeatherCache,
  type WeatherCacheSnapshot,
} from "./weather-cache.ts";

interface WeatherRefreshResult {
  errorCode?: string;
  retainedPreviousSnapshot: boolean;
  snapshot: WeatherCacheSnapshot | null;
  success: boolean;
  warnings: readonly string[];
}

type WeatherHttpClient = (context: CityContext) => Promise<OpenMeteoCurrentWeather | null>;

async function refreshWeather({
  cachePath,
  context,
  httpClient = createOpenMeteoWeatherClient({ cache: "no-store" }),
  now = () => new Date(),
}: {
  cachePath?: string;
  context: CityContext;
  httpClient?: WeatherHttpClient;
  now?: () => Date;
}): Promise<WeatherRefreshResult> {
  const resolvedCachePath = cachePath ?? getWeatherCachePath(context.city.id);
  const previous = await readWeatherCache(context.city.id, resolvedCachePath);

  try {
    const weather = await httpClient(context);
    if (!weather) return retainPrevious(previous, "weather-response-empty");

    const timestamp = now().toISOString();
    const snapshot: WeatherCacheSnapshot = {
      cityId: context.city.id,
      fetchedAt: timestamp,
      lastSuccessfulRefreshAt: timestamp,
      provider: "open-meteo",
      schemaVersion: 1,
      sourceUrl: weatherSourceUrl,
      weather: toWeatherSnapshotWeather(weather),
    };

    try {
      await writeWeatherCache(snapshot, resolvedCachePath);
    } catch {
      return retainPrevious(previous, "weather-cache-write-failed");
    }

    return {
      retainedPreviousSnapshot: false,
      snapshot,
      success: true,
      warnings: [],
    };
  } catch {
    return retainPrevious(previous, "weather-refresh-failed");
  }
}

function retainPrevious(
  previous: WeatherCacheSnapshot | null,
  errorCode: string,
): WeatherRefreshResult {
  return {
    errorCode,
    retainedPreviousSnapshot: previous !== null,
    snapshot: previous ? { ...previous, lastRefreshError: errorCode } : null,
    success: false,
    warnings: [],
  };
}

export { refreshWeather, type WeatherHttpClient, type WeatherRefreshResult };
