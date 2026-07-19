import { env } from "@/config/env";
import { refreshCityAlerts } from "@/modules/city-alerts/infrastructure/city-alerts-refresh";
import { createRefreshPostHandler } from "./refresh-post-handler";

export const POST = createRefreshPostHandler({
  refresh: refreshCityAlerts,
  secret: env.CITY_ALERTS_REFRESH_SECRET,
});
