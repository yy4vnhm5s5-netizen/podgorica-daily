import { env } from "@/config/env";
import { runVikpgCollector } from "@/modules/city-alerts/infrastructure/collect-vikpg";
import { createRefreshPostHandler } from "../../refresh-post-handler";
import { toCityAlertRefreshEndpointResult } from "../../provider-refresh-result";

export const POST = createRefreshPostHandler({
  refresh: async () => toCityAlertRefreshEndpointResult("vikpg", await runVikpgCollector()),
  secret: env.VIKPG_REFRESH_SECRET,
});
