import { env } from "@/config/env";
import { runActiveFlightsCollectors } from "@/modules/flights/infrastructure/collect-podgorica-flights";
import { createRefreshPostHandler } from "../../refresh-post-handler";
import { toMultiCityFlightsRefreshEndpointResult } from "../../provider-refresh-result";

export const POST = createRefreshPostHandler({
  refresh: async () =>
    toMultiCityFlightsRefreshEndpointResult(await runActiveFlightsCollectors()),
  secret: env.FLIGHTS_REFRESH_SECRET,
});
