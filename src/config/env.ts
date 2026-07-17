import { z } from "zod";

const environmentSchema = z.object({
  CEDIS_PROVIDER_MODE: z.enum(["disabled", "live", "mock"]).default("live"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_APP_ENV: z.string().min(1).default("development"),
});

const parsedEnvironment = environmentSchema.safeParse({
  NODE_ENV: process.env.NODE_ENV,
  CEDIS_PROVIDER_MODE: process.env.CEDIS_PROVIDER_MODE,
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

export const env = parsedEnvironment.data;
