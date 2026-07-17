import { getDefaultCityContext } from "../../../config/city-context.ts";
import { createTourismHttpClient } from "./tourism-http-client.ts";
import { refreshTourismEvents } from "./tourism-refresh.ts";
void refreshTourismEvents({
  cachePath: ".runtime/cache/tourism-events.json",
  context: getDefaultCityContext(),
  httpClient: createTourismHttpClient(),
}).then((result) => {
  process.stdout.write(
    `${JSON.stringify({ status: result.success ? "success" : result.retainedPreviousSnapshot ? "retained" : "unavailable", ...result })}\n`,
  );
  if (!result.success && !result.retainedPreviousSnapshot) process.exitCode = 1;
});
