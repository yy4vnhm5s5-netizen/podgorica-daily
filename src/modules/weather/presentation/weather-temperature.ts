import type { CurrentWeatherResult } from "../application/get-current-weather.ts";

/**
 * Returns the single resolved current-temperature value that every weather
 * presentation surface uses. It intentionally has no fallback to overview data.
 */
function getWeatherTemperature(result: CurrentWeatherResult | null) {
  return result?.status === "success" ? result.data.temperature : undefined;
}

export { getWeatherTemperature };
