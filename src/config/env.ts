import { z } from "zod";

import { isCityId } from "@/shared/config/cities";

const environmentSchema = z.object({
  CEDIS_PROVIDER_MODE: z.enum(["disabled", "live", "mock"]).default("live"),
  AMSCG_PROVIDER_MODE: z.enum(["disabled", "live"]).default("live"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DEFAULT_CITY: z.string().default("podgorica"),
  ENABLE_AMSCG: z.enum(["false", "true"]).default("true"),
  ENABLE_CEDIS: z.enum(["false", "true"]).default("true"),
  ENABLE_WEATHER: z.enum(["false", "true"]).default("true"),
  NEXT_PUBLIC_APP_ENV: z.string().min(1).default("development"),
});

const parsedEnvironment = environmentSchema.safeParse({
  NODE_ENV: process.env.NODE_ENV,
  CEDIS_PROVIDER_MODE: process.env.CEDIS_PROVIDER_MODE,
  AMSCG_PROVIDER_MODE: process.env.AMSCG_PROVIDER_MODE,
  DEFAULT_CITY: process.env.DEFAULT_CITY,
  ENABLE_AMSCG: process.env.ENABLE_AMSCG,
  ENABLE_CEDIS: process.env.ENABLE_CEDIS,
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

if (!isCityId(parsedEnvironment.data.DEFAULT_CITY)) {
  throw new Error("DEFAULT_CITY must exist in the city registry.");
}

export const env = {
  ...parsedEnvironment.data,
  DEFAULT_CITY: parsedEnvironment.data.DEFAULT_CITY,
  ENABLE_AMSCG: parsedEnvironment.data.ENABLE_AMSCG === "true",
  ENABLE_CEDIS: parsedEnvironment.data.ENABLE_CEDIS === "true",
  ENABLE_WEATHER: parsedEnvironment.data.ENABLE_WEATHER === "true",
};
