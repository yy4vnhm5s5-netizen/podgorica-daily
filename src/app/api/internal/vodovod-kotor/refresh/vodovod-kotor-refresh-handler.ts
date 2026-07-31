import { env } from "@/config/env";
import { runVodovodKotorCollector } from "@/modules/city-alerts/infrastructure/vodovod-kotor";

import { toVodovodKotorRefreshEndpointResult } from "../../provider-refresh-result.ts";
import { createRefreshPostHandler } from "../../refresh-post-handler.ts";

function createVodovodKotorRefreshPostHandler({
  runCollector = runVodovodKotorCollector,
  token = env.INTERNAL_REFRESH_TOKEN,
}: {
  runCollector?: typeof runVodovodKotorCollector;
  token?: string;
} = {}) {
  return createRefreshPostHandler({
    refresh: async () => toVodovodKotorRefreshEndpointResult(await runCollector()),
    secret: token,
  });
}

export { createVodovodKotorRefreshPostHandler };
