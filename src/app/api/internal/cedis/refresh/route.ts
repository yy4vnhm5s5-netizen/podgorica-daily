import { env } from "@/config/env";
import { runCedisCollector } from "@/modules/city-alerts/infrastructure/collect-cedis";
import { createRefreshPostHandler } from "../../refresh-post-handler";
import { toCityAlertRefreshEndpointResult } from "../../provider-refresh-result";

export const POST = createRefreshPostHandler({
  refresh: async () => toCityAlertRefreshEndpointResult("cedis", await runCedisCollector()),
  secret: env.CEDIS_REFRESH_SECRET,
});
