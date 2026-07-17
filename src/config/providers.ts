import { env } from "@/config/env";
import {
  amscgProviderMetadata,
  getAmscgCityAlerts,
} from "@/modules/city-alerts/infrastructure/amscg-city-alerts-provider";
import {
  cedisProviderMetadata,
  getCedisCityAlerts,
} from "@/modules/city-alerts/infrastructure/cedis-city-alerts-provider";
import { weatherProviderMetadata } from "@/modules/weather/infrastructure/open-meteo-weather-client";
import type { CityContext } from "@/shared/types/city";
import type { ProviderMetadata } from "@/shared/types/provider";

const providerRegistry: readonly ProviderMetadata[] = [
  { ...cedisProviderMetadata, enabled: env.ENABLE_CEDIS },
  { ...amscgProviderMetadata, enabled: env.ENABLE_AMSCG },
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
    getAmscgCityAlerts({
      context,
      mode: env.ENABLE_AMSCG ? env.AMSCG_PROVIDER_MODE : "disabled",
    }),
  ]);
}

export { getCityAlertProviderData, getProviderMetadata, providerRegistry };
