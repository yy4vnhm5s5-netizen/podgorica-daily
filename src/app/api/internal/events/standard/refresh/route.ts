import { env } from "@/config/env";
import { refreshStandardEvents } from "@/modules/events/infrastructure/events-refresh";
import { createRefreshPostHandler } from "../../../refresh-post-handler";
import { toEventRefreshEndpointResult } from "../../../provider-refresh-result";

export const POST = createRefreshPostHandler({
  refresh: async () =>
    toEventRefreshEndpointResult("standard-events", await refreshStandardEvents()),
  secret: env.STANDARD_EVENTS_REFRESH_SECRET,
});
