import { getDefaultCityContext } from "../../../config/city-context.ts";
import { env } from "../../../config/env.ts";
import { createTourismHttpClient } from "./tourism-http-client.ts";
import { refreshTourismEvents } from "./tourism-refresh.ts";
void refreshTourismEvents({
  cachePath: env.TOURISM_EVENT_CACHE_PATH,
  context: getDefaultCityContext(),
  httpClient: createTourismHttpClient(),
}).then((result) => {
  process.stdout.write(
    `${JSON.stringify({ status: result.success ? "success" : result.retainedPreviousSnapshot ? "retained" : "unavailable", ...result })}\n`,
  );
  if (!result.success && !result.retainedPreviousSnapshot) process.exitCode = 1;
});
