import { getDefaultCityContext } from "@/config/city-context";
import { getWeatherCondition, type CurrentWeather } from "@/modules/weather/domain/current-weather";
import { fetchOpenMeteoCurrentWeather } from "@/modules/weather/infrastructure/open-meteo-weather-client";
import type { CityContext } from "@/shared/types/city";

type CurrentWeatherResult =
  { data: CurrentWeather; status: "success" } | { status: "empty" } | { status: "error" };

async function getCurrentWeather(
  context: CityContext = getDefaultCityContext(),
): Promise<CurrentWeatherResult> {
  try {
    const weather = await fetchOpenMeteoCurrentWeather(context);

    if (!weather) {
      return { status: "empty" };
    }

    return {
      data: {
        apparentTemperature: weather.apparent_temperature ?? null,
        cityIds: [context.city.id],
        condition: getWeatherCondition(weather.weather_code),
        humidity: weather.relative_humidity_2m,
        temperature: weather.temperature_2m,
        updatedAt: new Date(weather.time * 1000),
        windSpeed: weather.wind_speed_10m,
      },
      status: "success",
    };
  } catch {
    return { status: "error" };
  }
}

export { getCurrentWeather, type CurrentWeatherResult };
