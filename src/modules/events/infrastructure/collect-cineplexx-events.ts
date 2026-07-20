import { getDefaultCityContext } from "../../../config/city-context.ts";
import { getEventQualityPolicy } from "../../../config/event-quality.ts";
import { env } from "../../../config/env.ts";
import { createCineplexxBrowserRenderer } from "./cineplexx-browser-renderer.ts";
import { readEventCacheSnapshot } from "./events-cache.ts";
import { refreshCineplexxProgramme } from "./cineplexx-refresh.ts";

void refreshCineplexxProgramme({
  cachePath: env.CINEPLEXX_EVENT_CACHE_PATH,
  context: getDefaultCityContext(),
  previousSnapshot: await readEventCacheSnapshot(env.CINEPLEXX_EVENT_CACHE_PATH),
  qualityPolicy: getEventQualityPolicy(),
  renderer: createCineplexxBrowserRenderer(),
}).then((result) => {
  process.stdout.write(
    `${JSON.stringify({ status: result.success ? "success" : result.retainedPreviousSnapshot ? "retained" : "unavailable", ...result })}\n`,
  );
  if (!result.success && !result.retainedPreviousSnapshot) process.exitCode = 1;
});
