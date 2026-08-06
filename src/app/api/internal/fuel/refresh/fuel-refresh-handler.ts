import { env } from "@/config/env";
import { runFuelPricesCollector } from "@/modules/fuel/infrastructure/gov-me-fuel-prices";

import { toFuelRefreshEndpointResult } from "../../provider-refresh-result.ts";
import { createRefreshPostHandler } from "../../refresh-post-handler.ts";

function createFuelRefreshPostHandler({
  runCollector = runFuelPricesCollector,
  token = env.INTERNAL_REFRESH_TOKEN,
}: {
  runCollector?: typeof runFuelPricesCollector;
  token?: string;
} = {}) {
  return createRefreshPostHandler({
    refresh: async () => toFuelRefreshEndpointResult(await runCollector()),
    secret: token,
  });
}

export { createFuelRefreshPostHandler };
