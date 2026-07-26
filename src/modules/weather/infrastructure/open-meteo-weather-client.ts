import { z } from "zod";

import type { CityContext } from "@/shared/types/city";
import type { ProviderMetadata } from "@/shared/types/provider";

const weatherRequestTimeoutMs = 8_000;

interface OpenMeteoFetchResponse {
  json(): Promise<unknown>;
  ok: boolean;
}

type OpenMeteoFetchImplementation = (
  url: URL,
  init: RequestInit & { next?: { revalidate: number } },
) => Promise<OpenMeteoFetchResponse>;

interface OpenMeteoWeatherClientOptions {
  fetchImplementation?: OpenMeteoFetchImplementation;
  timeoutMs?: number;
}

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

function createOpenMeteoWeatherClient({
  fetchImplementation = fetch,
  timeoutMs = weatherRequestTimeoutMs,
}: OpenMeteoWeatherClientOptions = {}) {
  return async function fetchCurrentWeather(context: CityContext) {
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

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetchImplementation(url, {
        headers: { Accept: "application/json" },
        next: { revalidate: 600 },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error("Open-Meteo current weather request failed");
      }

      return openMeteoResponseSchema.parse(await response.json()).current ?? null;
    } finally {
      clearTimeout(timeout);
    }
  };
}

async function fetchOpenMeteoCurrentWeather(context: CityContext) {
  return createOpenMeteoWeatherClient()(context);
}

const weatherProviderMetadata: ProviderMetadata = {
  displayName: "Open-Meteo current weather",
  enabled: true,
  id: "weather",
  officialSource: "https://open-meteo.com/",
  refreshIntervalMinutes: 10,
  supportsMultipleCities: true,
};

export {
  createOpenMeteoWeatherClient,
  fetchOpenMeteoCurrentWeather,
  weatherProviderMetadata,
  weatherRequestTimeoutMs,
  type OpenMeteoFetchImplementation,
  type OpenMeteoWeatherClientOptions,
};
