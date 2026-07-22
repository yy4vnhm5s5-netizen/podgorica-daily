import { env } from "@/config/env";
import {
  cedisProviderMetadata,
  getCedisCityAlerts,
} from "@/modules/city-alerts/infrastructure/cedis-city-alerts-provider";
import {
  getVikpgCityAlerts,
  vikpgProviderMetadata,
} from "@/modules/city-alerts/infrastructure/vikpg-city-alerts-provider";
import { weatherProviderMetadata } from "@/modules/weather/infrastructure/open-meteo-weather-client";
import type { CityContext } from "@/shared/types/city";
import type { ProviderMetadata } from "@/shared/types/provider";

const providerRegistry: readonly ProviderMetadata[] = [
  { ...cedisProviderMetadata, enabled: env.ENABLE_CEDIS },
  { ...vikpgProviderMetadata, enabled: env.ENABLE_VIKPG },
  { ...weatherProviderMetadata, enabled: env.ENABLE_WEATHER },
];

function getProviderMetadata(id: string) {
  return providerRegistry.find((provider) => provider.id === id);
}

async function getCityAlertProviderData(context: CityContext) {
  return Promise.all([
    getCedisCityAlerts({
      context,
      mode: env.ENABLE_CEDIS ? env.CEDIS_PROVIDER_MODE : "disabled",
    }),
    getVikpgCityAlerts({
      context,
      mode: env.ENABLE_VIKPG ? env.VIKPG_PROVIDER_MODE : "disabled",
    }),
  ]);
}

export { getCityAlertProviderData, getProviderMetadata, providerRegistry };
