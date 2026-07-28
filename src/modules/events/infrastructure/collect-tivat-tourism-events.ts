import { createCityContext } from "@/shared/config/cities";
import { createTivatTourismHttpClient } from "./tivat-tourism-http-client.ts";
import { defaultTivatTourismEventCachePath } from "./tivat-tourism-event-provider.ts";
import { refreshTivatTourismEvents } from "./tivat-tourism-refresh.ts";

void refreshTivatTourismEvents({
  cachePath: defaultTivatTourismEventCachePath,
  context: createCityContext("tivat"),
  httpClient: createTivatTourismHttpClient(),
}).then((result) => {
  process.stdout.write(
    `${JSON.stringify({ status: result.success ? "success" : result.retainedPreviousSnapshot ? "retained" : "unavailable", ...result })}\n`,
  );
  if (!result.success && !result.retainedPreviousSnapshot) process.exitCode = 1;
});
