import { env } from "@/config/env";
import { refreshCineplexxEvents } from "@/modules/events/infrastructure/events-refresh";
import { createRefreshPostHandler } from "../../refresh-post-handler";
import { toEventRefreshEndpointResult } from "../../provider-refresh-result";

export const POST = createRefreshPostHandler({
  refresh: async () => toEventRefreshEndpointResult("cineplexx", await refreshCineplexxEvents()),
  secret: env.CINEPLEXX_REFRESH_SECRET,
});
