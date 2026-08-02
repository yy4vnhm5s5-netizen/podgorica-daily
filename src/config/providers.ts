import { env } from "@/config/env";
import { isCitySupportedByProvider } from "@/shared/config/cities";
import {
  cedisProviderMetadata,
  getCedisCityAlerts,
} from "@/modules/city-alerts/infrastructure/cedis-city-alerts-provider";
import {
  getVikpgCityAlerts,
  vikpgProviderMetadata,
} from "@/modules/city-alerts/infrastructure/vikpg-city-alerts-provider";
import {
  getVodovodKotorCityAlerts,
  vodovodKotorProviderMetadata,
} from "@/modules/city-alerts/infrastructure/vodovod-kotor";
import { weatherProviderMetadata } from "@/modules/weather/infrastructure/open-meteo-weather-client";
import type { CityAlertServiceId } from "@/modules/city-alerts/application/city-alert-service-capabilities";
import type { CityContext } from "@/shared/types/city";
import type { ProviderMetadata } from "@/shared/types/provider";

const providerRegistry: readonly ProviderMetadata[] = [
  { ...cedisProviderMetadata, enabled: env.ENABLE_CEDIS },
  { ...vikpgProviderMetadata, enabled: env.ENABLE_VIKPG },
  { ...vodovodKotorProviderMetadata, enabled: env.ENABLE_VODOVOD_KOTOR },
  { ...weatherProviderMetadata, enabled: env.ENABLE_WEATHER },
];

function getProviderMetadata(id: string) {
  return providerRegistry.find((provider) => provider.id === id);
}

async function getCityAlertProviderData(
  context: CityContext,
  requestedServiceIds: readonly CityAlertServiceId[] = ["power", "water"],
) {
  return Promise.all([
    requestedServiceIds.includes("power")
      ? getCedisCityAlerts({
          context,
          mode: env.ENABLE_CEDIS ? env.CEDIS_PROVIDER_MODE : "disabled",
        })
      : Promise.resolve(undefined),
    requestedServiceIds.includes("water")
      ? getWaterCityAlerts(context)
      : Promise.resolve(undefined),
  ]);
}

function getWaterCityAlerts(context: CityContext) {
  if (isCitySupportedByProvider(context.city, vodovodKotorProviderMetadata.supportedCityIds)) {
    return getVodovodKotorCityAlerts({
      context,
      mode: env.ENABLE_VODOVOD_KOTOR ? "live" : "disabled",
    });
  }
  return getVikpgCityAlerts({
    context,
    mode: env.ENABLE_VIKPG ? env.VIKPG_PROVIDER_MODE : "disabled",
  }).then((result) => ({ ...result, providerId: "vikpg" as const }));
}

export { getCityAlertProviderData, getProviderMetadata, providerRegistry };
