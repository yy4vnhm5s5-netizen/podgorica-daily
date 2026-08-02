import { dirname, join } from "node:path";

import { env } from "../../../config/env.ts";
import {
  nodeFileSystem,
  readJsonCache,
  writeJsonCache,
  type CacheFileSystem,
} from "../../../shared/lib/cache.ts";
import { getWeatherCondition, type CurrentWeather } from "../domain/current-weather.ts";
import type { OpenMeteoCurrentWeather } from "./open-meteo-weather-client.ts";
import type { CityContext, CityId } from "@/shared/types/city";

type WeatherSnapshotState = "fresh" | "stale" | "unavailable";

interface WeatherCacheSnapshot {
  cityId: CityId;
  fetchedAt: string;
  lastRefreshError?: string;
  lastSuccessfulRefreshAt: string;
  provider: "open-meteo";
  schemaVersion: 1;
  sourceUrl: "https://api.open-meteo.com/v1/forecast";
  weather: WeatherSnapshotWeather;
}

interface WeatherSnapshotWeather {
  apparentTemperature: number | null;
  condition: CurrentWeather["condition"];
  humidity: number;
  temperature: number;
  updatedAt: string;
  windSpeed: number;
}

interface CachedWeatherResult {
  fetchedAt?: string;
  state: WeatherSnapshotState;
  weather?: CurrentWeather;
}

const weatherSourceUrl = "https://api.open-meteo.com/v1/forecast" as const;
const defaultWeatherCachePath = env.WEATHER_CACHE_PATH;

function getWeatherCachePath(cityId: CityId) {
  return cityId === "podgorica"
    ? defaultWeatherCachePath
    : join(dirname(defaultWeatherCachePath), `weather-${cityId}.json`);
}

function calculateWeatherSnapshotState(
  fetchedAt: Date | undefined,
  now = new Date(),
  freshForMinutes = env.WEATHER_CACHE_FRESHNESS_MINUTES,
  maxStaleMinutes = env.WEATHER_CACHE_MAX_STALE_MINUTES,
): WeatherSnapshotState {
  if (!fetchedAt || Number.isNaN(fetchedAt.getTime())) return "unavailable";

  const ageMinutes = (now.getTime() - fetchedAt.getTime()) / 60_000;
  if (ageMinutes <= freshForMinutes) return "fresh";
  return ageMinutes <= maxStaleMinutes ? "stale" : "unavailable";
}

function toWeatherSnapshotWeather(weather: OpenMeteoCurrentWeather): WeatherSnapshotWeather {
  return {
    apparentTemperature: weather.apparent_temperature ?? null,
    condition: getWeatherCondition(weather.weather_code),
    humidity: weather.relative_humidity_2m,
    temperature: weather.temperature_2m,
    updatedAt: new Date(weather.time * 1000).toISOString(),
    windSpeed: weather.wind_speed_10m,
  };
}

function toCurrentWeather(cityId: CityId, weather: WeatherSnapshotWeather): CurrentWeather | null {
  const updatedAt = new Date(weather.updatedAt);
  if (Number.isNaN(updatedAt.getTime())) return null;

  return {
    apparentTemperature: weather.apparentTemperature,
    cityIds: [cityId],
    condition: weather.condition,
    humidity: weather.humidity,
    temperature: weather.temperature,
    updatedAt,
    windSpeed: weather.windSpeed,
  };
}

async function readWeatherCache(
  cityId: CityId,
  cachePath = getWeatherCachePath(cityId),
  fileSystem: CacheFileSystem = nodeFileSystem,
): Promise<WeatherCacheSnapshot | null> {
  const snapshot = await readJsonCache<WeatherCacheSnapshot>(cachePath, fileSystem);
  return isValidWeatherCacheSnapshot(snapshot, cityId) ? snapshot : null;
}

async function writeWeatherCache(
  snapshot: WeatherCacheSnapshot,
  cachePath = getWeatherCachePath(snapshot.cityId),
  fileSystem: CacheFileSystem = nodeFileSystem,
) {
  await writeJsonCache(snapshot, cachePath, fileSystem);
}

async function getCachedCurrentWeather(
  context: CityContext,
  {
    cachePath = getWeatherCachePath(context.city.id),
    now = new Date(),
  }: { cachePath?: string; now?: Date } = {},
): Promise<CachedWeatherResult> {
  const snapshot = await readWeatherCache(context.city.id, cachePath);
  if (!snapshot) return { state: "unavailable" };

  const state = calculateWeatherSnapshotState(new Date(snapshot.fetchedAt), now);
  const weather = toCurrentWeather(context.city.id, snapshot.weather);
  if (state === "unavailable" || !weather) return { state: "unavailable" };

  return { fetchedAt: snapshot.fetchedAt, state, weather };
}

function isValidWeatherCacheSnapshot(
  value: unknown,
  cityId: CityId,
): value is WeatherCacheSnapshot {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<WeatherCacheSnapshot>;
  const weather = candidate.weather as Partial<WeatherSnapshotWeather> | undefined;

  return (
    candidate.cityId === cityId &&
    typeof candidate.fetchedAt === "string" &&
    typeof candidate.lastSuccessfulRefreshAt === "string" &&
    candidate.provider === "open-meteo" &&
    candidate.schemaVersion === 1 &&
    candidate.sourceUrl === weatherSourceUrl &&
    typeof weather === "object" &&
    weather !== null &&
    (typeof weather.apparentTemperature === "number" || weather.apparentTemperature === null) &&
    typeof weather.condition === "string" &&
    typeof weather.humidity === "number" &&
    typeof weather.temperature === "number" &&
    typeof weather.updatedAt === "string" &&
    typeof weather.windSpeed === "number"
  );
}

export {
  calculateWeatherSnapshotState,
  defaultWeatherCachePath,
  getCachedCurrentWeather,
  getWeatherCachePath,
  isValidWeatherCacheSnapshot,
  readWeatherCache,
  toWeatherSnapshotWeather,
  weatherSourceUrl,
  writeWeatherCache,
  type CachedWeatherResult,
  type WeatherCacheSnapshot,
  type WeatherSnapshotState,
};
