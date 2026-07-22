import { env } from "@/config/env";
import { runMonteGigsGoingOutCollector } from "@/modules/going-out/infrastructure/collect-montegigs-going-out";
import { createRefreshPostHandler } from "../../refresh-post-handler";
import { toGoingOutRefreshEndpointResult } from "../../provider-refresh-result";

export const POST = createRefreshPostHandler({
  refresh: async () => toGoingOutRefreshEndpointResult(await runMonteGigsGoingOutCollector()),
  secret: env.GOING_OUT_REFRESH_SECRET,
});
