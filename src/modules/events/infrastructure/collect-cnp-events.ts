import { getDefaultCityContext } from "../../../config/city-context.ts";
import { env } from "../../../config/env.ts";
import { fileURLToPath } from "node:url";

import { runCnpCollector } from "./cnp-collector.ts";
import { createCnpHttpClient } from "./cnp-http-client.ts";
import { readEventCacheSnapshot } from "./events-cache.ts";
import { refreshCnpEvents } from "./cnp-refresh.ts";

async function main() {
  const previousSnapshot = await readEventCacheSnapshot(env.CNP_EVENT_CACHE_PATH);
  const result = await runCnpCollector({
    refresh: () =>
      refreshCnpEvents({
        cachePath: env.CNP_EVENT_CACHE_PATH,
        context: getDefaultCityContext(),
        httpClient: createCnpHttpClient(),
        previousSnapshot,
      }),
  });
  process.exitCode = result.exitCode;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  void main().catch(() => {
    process.exitCode = 1;
  });
}
