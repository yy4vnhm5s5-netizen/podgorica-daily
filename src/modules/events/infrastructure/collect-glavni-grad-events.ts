import { getDefaultCityContext } from "../../../config/city-context.ts";
import { env } from "../../../config/env.ts";
import { createGlavniGradHttpClient } from "./glavni-grad-http-client.ts";
import { refreshGlavniGradEvents } from "./glavni-grad-refresh.ts";

void refreshGlavniGradEvents({
  cachePath: env.GLAVNI_GRAD_EVENT_CACHE_PATH,
  context: getDefaultCityContext(),
  httpClient: createGlavniGradHttpClient(),
}).catch(() => {
  process.exitCode = 1;
});
