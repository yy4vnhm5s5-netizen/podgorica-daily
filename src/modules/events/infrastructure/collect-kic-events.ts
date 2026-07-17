import { getDefaultCityContext } from "../../../config/city-context.ts";
import { env } from "../../../config/env.ts";
import { createKicHttpClient } from "./kic-http-client.ts";
import { refreshKicEvents } from "./kic-refresh.ts";

async function main() {
  await refreshKicEvents({
    cachePath: env.KIC_EVENT_CACHE_PATH,
    context: getDefaultCityContext(),
    httpClient: createKicHttpClient(),
  });
}

void main().catch(() => {
  process.exitCode = 1;
});
