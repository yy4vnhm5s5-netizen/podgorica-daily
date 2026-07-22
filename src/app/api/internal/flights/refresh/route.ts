import { env } from "@/config/env";
import { runPodgoricaFlightsCollector } from "@/modules/flights/infrastructure/collect-podgorica-flights";
import { createRefreshPostHandler } from "../../refresh-post-handler";
import { toFlightsRefreshEndpointResult } from "../../provider-refresh-result";

export const POST = createRefreshPostHandler({
  refresh: async () => toFlightsRefreshEndpointResult(await runPodgoricaFlightsCollector()),
  secret: env.FLIGHTS_REFRESH_SECRET,
});
