import { z } from "zod";

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

const podgoricaCoordinates = {
  latitude: "42.441",
  longitude: "19.263",
} as const;

async function fetchOpenMeteoCurrentWeather() {
  const url = new URL("https://api.open-meteo.com/v1/forecast");

  url.searchParams.set("latitude", podgoricaCoordinates.latitude);
  url.searchParams.set("longitude", podgoricaCoordinates.longitude);
  url.searchParams.set(
    "current",
    "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m",
  );
  url.searchParams.set("timeformat", "unixtime");
  url.searchParams.set("timezone", "Europe/Podgorica");
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

export { fetchOpenMeteoCurrentWeather };
