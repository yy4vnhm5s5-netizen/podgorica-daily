import { z } from "zod";

import { isCityId } from "../shared/config/cities.ts";

const environmentSchema = z.object({
  CEDIS_PROVIDER_MODE: z.enum(["disabled", "live", "mock"]).default("live"),
  AMSCG_PROVIDER_MODE: z.enum(["disabled", "live"]).default("live"),
  VIKPG_PROVIDER_MODE: z.enum(["disabled", "live"]).default("live"),
  EVENT_PROVIDER_MODE: z.enum(["disabled", "live", "mock"]).default("disabled"),
  EVENT_CACHE_PATH: z.string().min(1).default(".runtime/cache/events.json"),
  EVENT_CACHE_DIR: z.string().min(1).default(".runtime/cache"),
  EVENT_REFRESH_SECRET: z.string().min(32).optional(),
  EVENT_CACHE_FRESHNESS_MINUTES: z.coerce.number().int().positive().default(120),
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
  VIKPG_CACHE_PATH: z.string().min(1).optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DEFAULT_CITY: z.string().default("podgorica"),
  ENABLE_AMSCG: z.enum(["false", "true"]).default("true"),
  ENABLE_CEDIS: z.enum(["false", "true"]).default("true"),
  ENABLE_VIKPG: z.enum(["false", "true"]).default("true"),
  ENABLE_EVENTS: z.enum(["false", "true"]).default("false"),
  ENABLE_WEATHER: z.enum(["false", "true"]).default("true"),
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
  AMSCG_PROVIDER_MODE: process.env.AMSCG_PROVIDER_MODE,
  VIKPG_PROVIDER_MODE: process.env.VIKPG_PROVIDER_MODE,
  EVENT_PROVIDER_MODE: process.env.EVENT_PROVIDER_MODE,
  EVENT_CACHE_PATH: process.env.EVENT_CACHE_PATH,
  EVENT_CACHE_DIR: process.env.EVENT_CACHE_DIR,
  EVENT_REFRESH_SECRET: process.env.EVENT_REFRESH_SECRET,
  EVENT_CACHE_FRESHNESS_MINUTES: process.env.EVENT_CACHE_FRESHNESS_MINUTES,
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
  VIKPG_CACHE_PATH: process.env.VIKPG_CACHE_PATH,
  DEFAULT_CITY: process.env.DEFAULT_CITY,
  ENABLE_AMSCG: process.env.ENABLE_AMSCG,
  ENABLE_CEDIS: process.env.ENABLE_CEDIS,
  ENABLE_VIKPG: process.env.ENABLE_VIKPG,
  ENABLE_EVENTS: process.env.ENABLE_EVENTS,
  ENABLE_WEATHER: process.env.ENABLE_WEATHER,
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

const cacheDirectory = parsedEnvironment.data.EVENT_CACHE_DIR.replace(/\/+$/, "") || ".";
const resolvedEnvironment = {
  ...parsedEnvironment.data,
  CNP_EVENT_CACHE_PATH:
    parsedEnvironment.data.CNP_EVENT_CACHE_PATH ?? `${cacheDirectory}/cnp-events.json`,
  GLAVNI_GRAD_EVENT_CACHE_PATH:
    parsedEnvironment.data.GLAVNI_GRAD_EVENT_CACHE_PATH ??
    `${cacheDirectory}/glavni-grad-events.json`,
  KIC_EVENT_CACHE_PATH:
    parsedEnvironment.data.KIC_EVENT_CACHE_PATH ?? `${cacheDirectory}/kic-events.json`,
  TOURISM_EVENT_CACHE_PATH:
    parsedEnvironment.data.TOURISM_EVENT_CACHE_PATH ?? `${cacheDirectory}/tourism-events.json`,
  VIKPG_CACHE_PATH: parsedEnvironment.data.VIKPG_CACHE_PATH ?? ".runtime/cache/vikpg-water-alerts.json",
};

if (!isCityId(resolvedEnvironment.DEFAULT_CITY)) {
  throw new Error("DEFAULT_CITY must exist in the city registry.");
}

export const env = {
  ...resolvedEnvironment,
  DEFAULT_CITY: resolvedEnvironment.DEFAULT_CITY,
  ENABLE_AMSCG: resolvedEnvironment.ENABLE_AMSCG === "true",
  ENABLE_CEDIS: resolvedEnvironment.ENABLE_CEDIS === "true",
  ENABLE_VIKPG: resolvedEnvironment.ENABLE_VIKPG === "true",
  ENABLE_EVENTS: resolvedEnvironment.ENABLE_EVENTS === "true",
  ENABLE_WEATHER: resolvedEnvironment.ENABLE_WEATHER === "true",
  EVENT_QUALITY_WARN_MISSING_DESCRIPTION:
    resolvedEnvironment.EVENT_QUALITY_WARN_MISSING_DESCRIPTION === "true",
  EVENT_QUALITY_WARN_MISSING_START_TIME:
    resolvedEnvironment.EVENT_QUALITY_WARN_MISSING_START_TIME === "true",
  EVENT_QUALITY_WARN_MISSING_VENUE: resolvedEnvironment.EVENT_QUALITY_WARN_MISSING_VENUE === "true",
};

export { parseEnvironment };
