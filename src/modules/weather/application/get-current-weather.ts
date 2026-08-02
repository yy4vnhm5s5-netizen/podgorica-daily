import { getDefaultCityContext } from "@/config/city-context";
import type { CurrentWeather } from "@/modules/weather/domain/current-weather";
import { getCachedCurrentWeather } from "@/modules/weather/infrastructure/weather-cache";
import type { CityContext } from "@/shared/types/city";

type CurrentWeatherResult =
  { data: CurrentWeather; status: "success" } | { status: "empty" } | { status: "error" };

async function getCurrentWeather(
  context: CityContext = getDefaultCityContext(),
  { readWeather = getCachedCurrentWeather }: { readWeather?: typeof getCachedCurrentWeather } = {},
): Promise<CurrentWeatherResult> {
  try {
    const cached = await readWeather(context);
    return cached.weather ? { data: cached.weather, status: "success" } : { status: "error" };
  } catch {
    return { status: "error" };
  }
}

export { getCurrentWeather, type CurrentWeatherResult };
