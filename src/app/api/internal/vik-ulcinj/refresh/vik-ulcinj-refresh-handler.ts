import { env } from "@/config/env";
import { runVikUlcinjCollector } from "@/modules/city-alerts/infrastructure/vik-ulcinj";

import { toVikUlcinjRefreshEndpointResult } from "../../provider-refresh-result.ts";
import { createRefreshPostHandler } from "../../refresh-post-handler.ts";

function createVikUlcinjRefreshPostHandler({
  runCollector = runVikUlcinjCollector,
  token = env.INTERNAL_REFRESH_TOKEN,
}: {
  runCollector?: typeof runVikUlcinjCollector;
  token?: string;
} = {}) {
  return createRefreshPostHandler({
    refresh: async () => toVikUlcinjRefreshEndpointResult(await runCollector()),
    secret: token,
  });
}

export { createVikUlcinjRefreshPostHandler };
