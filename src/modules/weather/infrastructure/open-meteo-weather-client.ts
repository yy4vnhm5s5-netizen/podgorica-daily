import { z } from "zod";

import type { CityContext } from "@/shared/types/city";
import type { ProviderMetadata } from "@/shared/types/provider";

const currentWeatherSchema = z.object({
  apparent_temperature: z.number().finite().nullable().optional(),
  relative_humidity_2m: z.number().finite().min(0).max(100),
  temperature_2m: z.number().finite(),
  time: z.number().int().nonnegative(),
  weather_code: z.number().int(),
  wind_speed_10m: z.number().finite().nonnegative(),
});

const openMeteoResponseSchema = z.object({
  current: currentWeatherSchema.nullable().optional(),
});

async function fetchOpenMeteoCurrentWeather(context: CityContext) {
  const url = new URL("https://api.open-meteo.com/v1/forecast");

  url.searchParams.set("latitude", context.city.latitude.toString());
  url.searchParams.set("longitude", context.city.longitude.toString());
  url.searchParams.set(
    "current",
    "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m",
  );
  url.searchParams.set("timeformat", "unixtime");
  url.searchParams.set("timezone", context.timezone);
  url.searchParams.set("wind_speed_unit", "kmh");

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: 600 },
  });

  if (!response.ok) {
    throw new Error("Open-Meteo current weather request failed");
  }

  return openMeteoResponseSchema.parse(await response.json()).current ?? null;
}

const weatherProviderMetadata: ProviderMetadata = {
  displayName: "Open-Meteo current weather",
  enabled: true,
  id: "weather",
  officialSource: "https://open-meteo.com/",
  refreshIntervalMinutes: 10,
  supportsMultipleCities: true,
};

export { fetchOpenMeteoCurrentWeather, weatherProviderMetadata };
