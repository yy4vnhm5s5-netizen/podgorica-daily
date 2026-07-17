import { z } from "zod";

import { isCityId } from "../shared/config/cities.ts";

const environmentSchema = z.object({
  CEDIS_PROVIDER_MODE: z.enum(["disabled", "live", "mock"]).default("live"),
  AMSCG_PROVIDER_MODE: z.enum(["disabled", "live"]).default("live"),
  EVENT_PROVIDER_MODE: z.enum(["disabled", "live", "mock"]).default("disabled"),
  EVENT_CACHE_PATH: z.string().min(1).default(".runtime/cache/events.json"),
  EVENT_CACHE_FRESHNESS_MINUTES: z.coerce.number().int().positive().default(120),
  EVENT_MAX_QUERY_RANGE_DAYS: z.coerce.number().int().positive().max(366).default(90),
  EVENT_MAX_RECURRENCE_OCCURRENCES: z.coerce.number().int().positive().max(100).default(30),
  KIC_EVENT_CACHE_PATH: z.string().min(1).default(".runtime/cache/kic-events.json"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DEFAULT_CITY: z.string().default("podgorica"),
  ENABLE_AMSCG: z.enum(["false", "true"]).default("true"),
  ENABLE_CEDIS: z.enum(["false", "true"]).default("true"),
  ENABLE_EVENTS: z.enum(["false", "true"]).default("false"),
  ENABLE_WEATHER: z.enum(["false", "true"]).default("true"),
  NEXT_PUBLIC_APP_ENV: z.string().min(1).default("development"),
});

const parsedEnvironment = environmentSchema.safeParse({
  NODE_ENV: process.env.NODE_ENV,
  CEDIS_PROVIDER_MODE: process.env.CEDIS_PROVIDER_MODE,
  AMSCG_PROVIDER_MODE: process.env.AMSCG_PROVIDER_MODE,
  EVENT_PROVIDER_MODE: process.env.EVENT_PROVIDER_MODE,
  EVENT_CACHE_PATH: process.env.EVENT_CACHE_PATH,
  EVENT_CACHE_FRESHNESS_MINUTES: process.env.EVENT_CACHE_FRESHNESS_MINUTES,
  EVENT_MAX_QUERY_RANGE_DAYS: process.env.EVENT_MAX_QUERY_RANGE_DAYS,
  EVENT_MAX_RECURRENCE_OCCURRENCES: process.env.EVENT_MAX_RECURRENCE_OCCURRENCES,
  KIC_EVENT_CACHE_PATH: process.env.KIC_EVENT_CACHE_PATH,
  DEFAULT_CITY: process.env.DEFAULT_CITY,
  ENABLE_AMSCG: process.env.ENABLE_AMSCG,
  ENABLE_CEDIS: process.env.ENABLE_CEDIS,
  ENABLE_EVENTS: process.env.ENABLE_EVENTS,
  ENABLE_WEATHER: process.env.ENABLE_WEATHER,
  NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
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

if (!isCityId(parsedEnvironment.data.DEFAULT_CITY)) {
  throw new Error("DEFAULT_CITY must exist in the city registry.");
}

export const env = {
  ...parsedEnvironment.data,
  DEFAULT_CITY: parsedEnvironment.data.DEFAULT_CITY,
  ENABLE_AMSCG: parsedEnvironment.data.ENABLE_AMSCG === "true",
  ENABLE_CEDIS: parsedEnvironment.data.ENABLE_CEDIS === "true",
  ENABLE_EVENTS: parsedEnvironment.data.ENABLE_EVENTS === "true",
  ENABLE_WEATHER: parsedEnvironment.data.ENABLE_WEATHER === "true",
};
