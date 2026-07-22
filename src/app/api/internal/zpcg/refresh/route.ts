import { env } from "@/config/env";
import { runZpcgRailwayCollector } from "@/modules/transport/infrastructure/collect-zpcg-railway";
import { createRefreshPostHandler } from "../../refresh-post-handler";
import { toZpcgRefreshEndpointResult } from "../../provider-refresh-result";

export const POST = createRefreshPostHandler({
  refresh: async () => toZpcgRefreshEndpointResult(await runZpcgRailwayCollector()),
  secret: env.ZPCG_RAILWAY_REFRESH_SECRET,
});
