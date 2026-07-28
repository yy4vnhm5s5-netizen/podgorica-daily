import {
  getCityEvents,
  getEmptyCityEventsReadModel,
} from "@/modules/events/application/get-city-events";
import { getPodgoricaFlights } from "@/modules/flights/application/get-podgorica-flights";
import { getGoingOutEvents } from "@/modules/going-out/application/get-going-out-events";
import { getBudvaSeaWaterQuality } from "@/modules/sea-water-quality/application/get-budva-sea-water-quality";
import { getRailwayDepartures } from "@/modules/transport/application/get-railway-departures";
import { getCurrentWeather } from "@/modules/weather/application/get-current-weather";
import { isFeatureEnabled } from "@/shared/config/features";
import type { CityContext } from "@/shared/types/city";

import { getCityDashboardCapabilities } from "./city-routing.ts";

interface CityDashboardDependencies {
  getBudvaSeaWaterQuality: typeof getBudvaSeaWaterQuality;
  getCityEvents: typeof getCityEvents;
  getCurrentWeather: typeof getCurrentWeather;
  getGoingOutEvents: typeof getGoingOutEvents;
  getPodgoricaFlights: typeof getPodgoricaFlights;
  getRailwayDepartures: typeof getRailwayDepartures;
  isFeatureEnabled: typeof isFeatureEnabled;
}

const defaultDependencies: CityDashboardDependencies = {
  getBudvaSeaWaterQuality,
  getCityEvents,
  getCurrentWeather,
  getGoingOutEvents,
  getPodgoricaFlights,
  getRailwayDepartures,
  isFeatureEnabled,
};

async function loadCityDashboardData(
  context: CityContext,
  dependencies: Partial<CityDashboardDependencies> = {},
) {
  const resolvedDependencies = { ...defaultDependencies, ...dependencies };
  const capabilities = getCityDashboardCapabilities(context);

  const [events, flights, goingOut, railway, seaWaterQuality, weather] = await Promise.all([
    capabilities.events
      ? resolvedDependencies.getCityEvents(context).catch(() => getEmptyCityEventsReadModel())
      : Promise.resolve(getEmptyCityEventsReadModel()),
    resolvedDependencies.isFeatureEnabled("flights") && capabilities.flights
      ? resolvedDependencies.getPodgoricaFlights(context).catch(() => null)
      : Promise.resolve(null),
    resolvedDependencies.isFeatureEnabled("goingOut") && capabilities.goingOut
      ? resolvedDependencies.getGoingOutEvents(context).catch(() => null)
      : Promise.resolve(null),
    capabilities.railway
      ? resolvedDependencies.getRailwayDepartures(context).catch(() => null)
      : Promise.resolve(null),
    resolvedDependencies.isFeatureEnabled("seaWaterQuality") && capabilities.seaWaterQuality
      ? resolvedDependencies.getBudvaSeaWaterQuality(context).catch(() => null)
      : Promise.resolve(null),
    resolvedDependencies.isFeatureEnabled("weather") && capabilities.weather
      ? resolvedDependencies.getCurrentWeather(context).catch(() => null)
      : Promise.resolve(null),
  ]);

  return { capabilities, events, flights, goingOut, railway, seaWaterQuality, weather };
}

export { loadCityDashboardData, type CityDashboardDependencies };
