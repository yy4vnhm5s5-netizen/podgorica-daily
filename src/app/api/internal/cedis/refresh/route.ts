import { env } from "@/config/env";
import { runActiveCedisCollectors } from "@/modules/city-alerts/infrastructure/collect-cedis";
import { createRefreshPostHandler } from "../../refresh-post-handler";
import { toMultiCityAlertRefreshEndpointResult } from "../../provider-refresh-result";

export const POST = createRefreshPostHandler({
  refresh: async () =>
    toMultiCityAlertRefreshEndpointResult("cedis", await runActiveCedisCollectors()),
  secret: env.CEDIS_REFRESH_SECRET,
});
