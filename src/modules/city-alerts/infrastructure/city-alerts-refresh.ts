import { env } from "@/config/env";
import { runCedisCollector } from "./collect-cedis.ts";
import { runVikpgCollector } from "./collect-vikpg.ts";
import {
  runCityAlertsRefresh,
  type CityAlertsRefreshProvider,
  type CityAlertsRefreshSummary,
} from "./city-alerts-refresh-runner.ts";

async function refreshCityAlerts({
  providers = defaultProviders(),
}: {
  providers?: readonly CityAlertsRefreshProvider[];
} = {}): Promise<CityAlertsRefreshSummary> {
  return runCityAlertsRefresh({ providers });
}

function defaultProviders(): CityAlertsRefreshProvider[] {
  return [
    ...(env.ENABLE_CEDIS && env.CEDIS_PROVIDER_MODE === "live"
      ? [{ id: "cedis" as const, refresh: () => runCedisCollector({ cachePath: env.CEDIS_CACHE_PATH }) }]
      : []),
    ...(env.ENABLE_VIKPG && env.VIKPG_PROVIDER_MODE === "live"
      ? [{ id: "vikpg" as const, refresh: () => runVikpgCollector({ cachePath: env.VIKPG_CACHE_PATH }) }]
      : []),
  ];
}

export {
  refreshCityAlerts,
};
