import { createZpcgHttpClient, refreshZpcgRailway } from "./zpcg-railway.ts";
import { env } from "@/config/env";

void refreshZpcgRailway({ cachePath: env.ZPCG_RAILWAY_CACHE_PATH, httpClient: createZpcgHttpClient() }).then((result) => {
  process.stdout.write(`${JSON.stringify({ status: result.success ? "success" : result.retainedPreviousSnapshot ? "retained" : "unavailable", ...result })}\n`);
  if (!result.success && !result.retainedPreviousSnapshot) process.exitCode = 1;
});
