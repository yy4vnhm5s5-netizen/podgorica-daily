import { env } from "@/config/env";
import { refreshAllEvents } from "@/modules/events/infrastructure/events-refresh";
import { createRefreshPostHandler } from "./refresh-post-handler";

export const POST = createRefreshPostHandler({
  refresh: refreshAllEvents,
  secret: env.EVENT_REFRESH_SECRET,
});
