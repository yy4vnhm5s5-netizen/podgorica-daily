import { z } from "zod";

import { isCityId } from "../shared/config/cities.ts";
import { normalizeRuntimeDataDirectory, resolveRuntimeCachePath } from "./runtime-data.ts";

const environmentSchema = z.object({
  CEDIS_PROVIDER_MODE: z.enum(["disabled", "live", "mock"]).default("live"),
  VIKPG_PROVIDER_MODE: z.enum(["disabled", "live"]).default("live"),
  EVENT_PROVIDER_MODE: z.enum(["disabled", "live", "mock"]).default("disabled"),
  EVENT_CACHE_PATH: z.string().min(1).optional(),
  EVENT_CACHE_DIR: z.string().min(1).optional(),
  EVENT_REFRESH_SECRET: z.string().min(32).optional(),
  STANDARD_EVENTS_REFRESH_SECRET: z.string().min(32).optional(),
  CINEPLEXX_REFRESH_SECRET: z.string().min(32).optional(),
  EVENT_CACHE_FRESHNESS_MINUTES: z.coerce.number().int().positive().default(240),
  CINEPLEXX_CACHE_FRESHNESS_MINUTES: z.coerce.number().int().positive().default(780),
  CHROMIUM_PATH: z.string().min(1).optional(),
  EVENT_MAX_QUERY_RANGE_DAYS: z.coerce.number().int().positive().max(366).default(90),
  EVENT_MAX_RECURRENCE_OCCURRENCES: z.coerce.number().int().positive().max(100).default(30),
  EVENT_QUALITY_COUNT_DROP_RATIO: z.coerce.number().min(0).max(1).default(0.5),
  EVENT_QUALITY_DEGRADED_WARNING_RATE: z.coerce.number().min(0).max(1).default(0.4),
  EVENT_QUALITY_FAILING_REJECTION_RATE: z.coerce.number().min(0).max(1).default(0.5),
  EVENT_QUALITY_MAX_FUTURE_DAYS: z.coerce.number().int().positive().max(3650).default(366),
  EVENT_QUALITY_MAX_PAST_DAYS: z.coerce.number().int().positive().max(3650).default(30),
  EVENT_QUALITY_MIN_SCORE: z.coerce.number().int().min(0).max(100).default(50),
  EVENT_QUALITY_WARN_MISSING_DESCRIPTION: z.enum(["false", "true"]).default("true"),
  EVENT_QUALITY_WARN_MISSING_START_TIME: z.enum(["false", "true"]).default("true"),
  EVENT_QUALITY_WARN_MISSING_VENUE: z.enum(["false", "true"]).default("true"),
  KIC_EVENT_CACHE_PATH: z.string().min(1).optional(),
  CNP_EVENT_CACHE_PATH: z.string().min(1).optional(),
  GLAVNI_GRAD_EVENT_CACHE_PATH: z.string().min(1).optional(),
  TOURISM_EVENT_CACHE_PATH: z.string().min(1).optional(),
  CINEPLEXX_EVENT_CACHE_PATH: z.string().min(1).optional(),
  PODGORICA_FLIGHTS_CACHE_PATH: z.string().min(1).optional(),
  PODGORICA_FLIGHTS_CACHE_FRESHNESS_MINUTES: z.coerce.number().int().positive().default(90),
  FLIGHTS_REFRESH_SECRET: z.string().min(32).optional(),
  GOING_OUT_CACHE_PATH: z.string().min(1).optional(),
  GOING_OUT_CACHE_FRESHNESS_MINUTES: z.coerce.number().int().positive().default(240),
  GOING_OUT_REFRESH_SECRET: z.string().min(32).optional(),
  ZPCG_RAILWAY_CACHE_PATH: z.string().min(1).optional(),
  ZPCG_RAILWAY_REFRESH_SECRET: z.string().min(32).optional(),
  INTERNAL_REFRESH_TOKEN: z.string().min(32).optional(),
  SNAPSHOT_DIAGNOSTICS_SECRET: z.string().min(32).optional(),
  CEDIS_CACHE_PATH: z.string().min(1).optional(),
  CEDIS_CACHE_FRESHNESS_MINUTES: z.coerce.number().int().positive().default(420),
  CEDIS_REFRESH_SECRET: z.string().min(32).optional(),
  VIKPG_CACHE_PATH: z.string().min(1).optional(),
  VIKPG_CACHE_FRESHNESS_MINUTES: z.coerce.number().int().positive().default(150),
  VIKPG_REFRESH_SECRET: z.string().min(32).optional(),
  VODOVOD_KOTOR_CACHE_PATH: z.string().min(1).optional(),
  VODOVOD_KOTOR_CACHE_FRESHNESS_MINUTES: z.coerce.number().int().positive().default(150),
  SEA_WATER_QUALITY_CACHE_PATH: z.string().min(1).optional(),
  // Individual bathing locations are re-sampled roughly every 3 days during the season, so 3 days
  // (4320 minutes) tracks the real update cadence — long enough that one missed daily refresh
  // doesn't falsely flag genuinely current data as stale, short enough to surface an actually
  // broken collector within a reasonable window.
  SEA_WATER_QUALITY_CACHE_FRESHNESS_MINUTES: z.coerce.number().int().positive().default(4_320),
  SEA_WATER_QUALITY_REFRESH_SECRET: z.string().min(32).optional(),
  CITY_ALERTS_REFRESH_SECRET: z.string().min(32).optional(),
  CONTACT_EMAIL: z.string().email().optional(),
  CONTACT_FROM_EMAIL: z.string().trim().email().optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  RUNTIME_DATA_DIR: z.string().min(1).default(".runtime"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DEFAULT_CITY: z.string().default("podgorica"),
  ENABLE_CEDIS: z.enum(["false", "true"]).default("true"),
  ENABLE_VIKPG: z.enum(["false", "true"]).default("true"),
  ENABLE_VODOVOD_KOTOR: z.enum(["false", "true"]).default("false"),
  ENABLE_EVENTS: z.enum(["false", "true"]).default("false"),
  ENABLE_FLIGHTS: z.enum(["false", "true"]).default("true"),
  ENABLE_GOING_OUT: z.enum(["false", "true"]).default("true"),
  ENABLE_WEATHER: z.enum(["false", "true"]).default("true"),
  WEATHER_CACHE_PATH: z.string().min(1).optional(),
  WEATHER_CACHE_FRESHNESS_MINUTES: z.coerce.number().int().positive().default(15),
  WEATHER_CACHE_MAX_STALE_MINUTES: z.coerce.number().int().positive().default(30),
  WEATHER_REFRESH_SECRET: z.string().min(32).optional(),
  ENABLE_SEA_WATER_QUALITY: z.enum(["false", "true"]).default("true"),
  NEXT_PUBLIC_APP_ENV: z.string().min(1).default("development"),
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
});

function parseEnvironment(values: Record<string, string | undefined>) {
  const parsed = environmentSchema.safeParse({
    ...values,
    NODE_ENV: values.NODE_ENV,
  });
  if (!parsed.success)
    throw new Error(`Invalid environment configuration: ${parsed.error.message}`);
  return parsed.data;
}

const parsedEnvironment = environmentSchema.safeParse({
  NODE_ENV: process.env.NODE_ENV,
  CEDIS_PROVIDER_MODE: process.env.CEDIS_PROVIDER_MODE,
  VIKPG_PROVIDER_MODE: process.env.VIKPG_PROVIDER_MODE,
  EVENT_PROVIDER_MODE: process.env.EVENT_PROVIDER_MODE,
  EVENT_CACHE_PATH: process.env.EVENT_CACHE_PATH,
  EVENT_CACHE_DIR: process.env.EVENT_CACHE_DIR,
  EVENT_REFRESH_SECRET: process.env.EVENT_REFRESH_SECRET,
  STANDARD_EVENTS_REFRESH_SECRET: process.env.STANDARD_EVENTS_REFRESH_SECRET,
  CINEPLEXX_REFRESH_SECRET: process.env.CINEPLEXX_REFRESH_SECRET,
  EVENT_CACHE_FRESHNESS_MINUTES: process.env.EVENT_CACHE_FRESHNESS_MINUTES,
  CINEPLEXX_CACHE_FRESHNESS_MINUTES: process.env.CINEPLEXX_CACHE_FRESHNESS_MINUTES,
  CHROMIUM_PATH: process.env.CHROMIUM_PATH,
  EVENT_MAX_QUERY_RANGE_DAYS: process.env.EVENT_MAX_QUERY_RANGE_DAYS,
  EVENT_MAX_RECURRENCE_OCCURRENCES: process.env.EVENT_MAX_RECURRENCE_OCCURRENCES,
  EVENT_QUALITY_COUNT_DROP_RATIO: process.env.EVENT_QUALITY_COUNT_DROP_RATIO,
  EVENT_QUALITY_DEGRADED_WARNING_RATE: process.env.EVENT_QUALITY_DEGRADED_WARNING_RATE,
  EVENT_QUALITY_FAILING_REJECTION_RATE: process.env.EVENT_QUALITY_FAILING_REJECTION_RATE,
  EVENT_QUALITY_MAX_FUTURE_DAYS: process.env.EVENT_QUALITY_MAX_FUTURE_DAYS,
  EVENT_QUALITY_MAX_PAST_DAYS: process.env.EVENT_QUALITY_MAX_PAST_DAYS,
  EVENT_QUALITY_MIN_SCORE: process.env.EVENT_QUALITY_MIN_SCORE,
  EVENT_QUALITY_WARN_MISSING_DESCRIPTION: process.env.EVENT_QUALITY_WARN_MISSING_DESCRIPTION,
  EVENT_QUALITY_WARN_MISSING_START_TIME: process.env.EVENT_QUALITY_WARN_MISSING_START_TIME,
  EVENT_QUALITY_WARN_MISSING_VENUE: process.env.EVENT_QUALITY_WARN_MISSING_VENUE,
  KIC_EVENT_CACHE_PATH: process.env.KIC_EVENT_CACHE_PATH,
  CNP_EVENT_CACHE_PATH: process.env.CNP_EVENT_CACHE_PATH,
  GLAVNI_GRAD_EVENT_CACHE_PATH: process.env.GLAVNI_GRAD_EVENT_CACHE_PATH,
  TOURISM_EVENT_CACHE_PATH: process.env.TOURISM_EVENT_CACHE_PATH,
  CINEPLEXX_EVENT_CACHE_PATH: process.env.CINEPLEXX_EVENT_CACHE_PATH,
  PODGORICA_FLIGHTS_CACHE_PATH: process.env.PODGORICA_FLIGHTS_CACHE_PATH,
  PODGORICA_FLIGHTS_CACHE_FRESHNESS_MINUTES: process.env.PODGORICA_FLIGHTS_CACHE_FRESHNESS_MINUTES,
  FLIGHTS_REFRESH_SECRET: process.env.FLIGHTS_REFRESH_SECRET,
  GOING_OUT_CACHE_PATH: process.env.GOING_OUT_CACHE_PATH,
  GOING_OUT_CACHE_FRESHNESS_MINUTES: process.env.GOING_OUT_CACHE_FRESHNESS_MINUTES,
  GOING_OUT_REFRESH_SECRET: process.env.GOING_OUT_REFRESH_SECRET,
  ZPCG_RAILWAY_CACHE_PATH: process.env.ZPCG_RAILWAY_CACHE_PATH,
  ZPCG_RAILWAY_REFRESH_SECRET: process.env.ZPCG_RAILWAY_REFRESH_SECRET,
  INTERNAL_REFRESH_TOKEN: process.env.INTERNAL_REFRESH_TOKEN,
  SNAPSHOT_DIAGNOSTICS_SECRET: process.env.SNAPSHOT_DIAGNOSTICS_SECRET,
  CEDIS_CACHE_PATH: process.env.CEDIS_CACHE_PATH,
  CEDIS_CACHE_FRESHNESS_MINUTES: process.env.CEDIS_CACHE_FRESHNESS_MINUTES,
  CEDIS_REFRESH_SECRET: process.env.CEDIS_REFRESH_SECRET,
  VIKPG_CACHE_PATH: process.env.VIKPG_CACHE_PATH,
  VIKPG_CACHE_FRESHNESS_MINUTES: process.env.VIKPG_CACHE_FRESHNESS_MINUTES,
  VIKPG_REFRESH_SECRET: process.env.VIKPG_REFRESH_SECRET,
  VODOVOD_KOTOR_CACHE_PATH: process.env.VODOVOD_KOTOR_CACHE_PATH,
  VODOVOD_KOTOR_CACHE_FRESHNESS_MINUTES: process.env.VODOVOD_KOTOR_CACHE_FRESHNESS_MINUTES,
  SEA_WATER_QUALITY_CACHE_PATH: process.env.SEA_WATER_QUALITY_CACHE_PATH,
  SEA_WATER_QUALITY_CACHE_FRESHNESS_MINUTES: process.env.SEA_WATER_QUALITY_CACHE_FRESHNESS_MINUTES,
  SEA_WATER_QUALITY_REFRESH_SECRET: process.env.SEA_WATER_QUALITY_REFRESH_SECRET,
  CITY_ALERTS_REFRESH_SECRET: process.env.CITY_ALERTS_REFRESH_SECRET,
  CONTACT_EMAIL: process.env.CONTACT_EMAIL,
  CONTACT_FROM_EMAIL: process.env.CONTACT_FROM_EMAIL,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  RUNTIME_DATA_DIR: process.env.RUNTIME_DATA_DIR,
  DEFAULT_CITY: process.env.DEFAULT_CITY,
  ENABLE_CEDIS: process.env.ENABLE_CEDIS,
  ENABLE_VIKPG: process.env.ENABLE_VIKPG,
  ENABLE_VODOVOD_KOTOR: process.env.ENABLE_VODOVOD_KOTOR,
  ENABLE_EVENTS: process.env.ENABLE_EVENTS,
  ENABLE_FLIGHTS: process.env.ENABLE_FLIGHTS,
  ENABLE_GOING_OUT: process.env.ENABLE_GOING_OUT,
  ENABLE_WEATHER: process.env.ENABLE_WEATHER,
  WEATHER_CACHE_PATH: process.env.WEATHER_CACHE_PATH,
  WEATHER_CACHE_FRESHNESS_MINUTES: process.env.WEATHER_CACHE_FRESHNESS_MINUTES,
  WEATHER_CACHE_MAX_STALE_MINUTES: process.env.WEATHER_CACHE_MAX_STALE_MINUTES,
  WEATHER_REFRESH_SECRET: process.env.WEATHER_REFRESH_SECRET,
  ENABLE_SEA_WATER_QUALITY: process.env.ENABLE_SEA_WATER_QUALITY,
  NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
});

if (!parsedEnvironment.success) {
  throw new Error(`Invalid environment configuration: ${parsedEnvironment.error.message}`);
}

if (
  parsedEnvironment.data.CEDIS_PROVIDER_MODE === "mock" &&
  parsedEnvironment.data.NODE_ENV === "production"
) {
  throw new Error("CEDIS_PROVIDER_MODE=mock is not allowed in production.");
}

if (
  parsedEnvironment.data.EVENT_PROVIDER_MODE === "mock" &&
  parsedEnvironment.data.NODE_ENV === "production"
) {
  throw new Error("EVENT_PROVIDER_MODE=mock is not allowed in production.");
}

const runtimeDataDirectory = normalizeRuntimeDataDirectory(parsedEnvironment.data.RUNTIME_DATA_DIR);
const cacheDirectory =
  parsedEnvironment.data.EVENT_CACHE_DIR?.replace(/\/+$/, "") || `${runtimeDataDirectory}/cache`;
const resolvedEnvironment = {
  ...parsedEnvironment.data,
  CEDIS_CACHE_PATH:
    parsedEnvironment.data.CEDIS_CACHE_PATH ??
    resolveRuntimeCachePath("cedis-planned-outages.json", runtimeDataDirectory),
  CNP_EVENT_CACHE_PATH:
    parsedEnvironment.data.CNP_EVENT_CACHE_PATH ?? `${cacheDirectory}/cnp-events.json`,
  GLAVNI_GRAD_EVENT_CACHE_PATH:
    parsedEnvironment.data.GLAVNI_GRAD_EVENT_CACHE_PATH ??
    `${cacheDirectory}/glavni-grad-events.json`,
  KIC_EVENT_CACHE_PATH:
    parsedEnvironment.data.KIC_EVENT_CACHE_PATH ?? `${cacheDirectory}/kic-events.json`,
  EVENT_CACHE_DIR: cacheDirectory,
  EVENT_CACHE_PATH: parsedEnvironment.data.EVENT_CACHE_PATH ?? `${cacheDirectory}/events.json`,
  TOURISM_EVENT_CACHE_PATH:
    parsedEnvironment.data.TOURISM_EVENT_CACHE_PATH ?? `${cacheDirectory}/tourism-events.json`,
  CINEPLEXX_EVENT_CACHE_PATH:
    parsedEnvironment.data.CINEPLEXX_EVENT_CACHE_PATH ?? `${cacheDirectory}/cineplexx-events.json`,
  PODGORICA_FLIGHTS_CACHE_PATH:
    parsedEnvironment.data.PODGORICA_FLIGHTS_CACHE_PATH ??
    `${cacheDirectory}/podgorica-flights.json`,
  GOING_OUT_CACHE_PATH:
    parsedEnvironment.data.GOING_OUT_CACHE_PATH ?? `${cacheDirectory}/montegigs-going-out.json`,
  ZPCG_RAILWAY_CACHE_PATH:
    parsedEnvironment.data.ZPCG_RAILWAY_CACHE_PATH ??
    `${cacheDirectory}/zpcg-railway-departures.json`,
  VIKPG_CACHE_PATH:
    parsedEnvironment.data.VIKPG_CACHE_PATH ??
    resolveRuntimeCachePath("vikpg-water-alerts.json", runtimeDataDirectory),
  VODOVOD_KOTOR_CACHE_PATH:
    parsedEnvironment.data.VODOVOD_KOTOR_CACHE_PATH ??
    resolveRuntimeCachePath("vodovod-kotor-water-alerts.json", runtimeDataDirectory),
  SEA_WATER_QUALITY_CACHE_PATH:
    parsedEnvironment.data.SEA_WATER_QUALITY_CACHE_PATH ??
    `${cacheDirectory}/budva-sea-water-quality.json`,
  WEATHER_CACHE_PATH:
    parsedEnvironment.data.WEATHER_CACHE_PATH ?? `${cacheDirectory}/weather-podgorica.json`,
  RUNTIME_DATA_DIR: runtimeDataDirectory,
};

if (!isCityId(resolvedEnvironment.DEFAULT_CITY)) {
  throw new Error("DEFAULT_CITY must exist in the city registry.");
}

export const env = {
  ...resolvedEnvironment,
  DEFAULT_CITY: resolvedEnvironment.DEFAULT_CITY,
  ENABLE_CEDIS: resolvedEnvironment.ENABLE_CEDIS === "true",
  ENABLE_VIKPG: resolvedEnvironment.ENABLE_VIKPG === "true",
  ENABLE_VODOVOD_KOTOR: resolvedEnvironment.ENABLE_VODOVOD_KOTOR === "true",
  ENABLE_EVENTS: resolvedEnvironment.ENABLE_EVENTS === "true",
  ENABLE_FLIGHTS: resolvedEnvironment.ENABLE_FLIGHTS === "true",
  ENABLE_GOING_OUT: resolvedEnvironment.ENABLE_GOING_OUT === "true",
  ENABLE_WEATHER: resolvedEnvironment.ENABLE_WEATHER === "true",
  ENABLE_SEA_WATER_QUALITY: resolvedEnvironment.ENABLE_SEA_WATER_QUALITY === "true",
  EVENT_QUALITY_WARN_MISSING_DESCRIPTION:
    resolvedEnvironment.EVENT_QUALITY_WARN_MISSING_DESCRIPTION === "true",
  EVENT_QUALITY_WARN_MISSING_START_TIME:
    resolvedEnvironment.EVENT_QUALITY_WARN_MISSING_START_TIME === "true",
  EVENT_QUALITY_WARN_MISSING_VENUE: resolvedEnvironment.EVENT_QUALITY_WARN_MISSING_VENUE === "true",
};

export { parseEnvironment };
