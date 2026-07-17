import type {
  CachedCityDataProvider,
  CityDataSnapshot,
} from "@/modules/daily-overview/domain/daily-overview";
import type { CityContext } from "@/shared/types/city";

function createMockCachedCityData(now: Date, context: CityContext): CityDataSnapshot {
  return {
    airQuality: { data: { category: "good" }, status: "available" },
    alerts: {
      data: [
        { isActive: true, isMajor: false, severity: "warning", type: "roadWorks" },
        { isActive: true, isMajor: false, severity: "information", type: "waterOutage" },
      ],
      status: "available",
    },
    cityIds: [context.city.id],
    events: { status: "unavailable" },
    generatedAt: now,
    isDemoData: true,
    weather: { data: { temperatureCelsius: 24 }, status: "available" },
  };
}

const mockCachedCityDataProvider: CachedCityDataProvider = {
  async getCachedCityData(context) {
    return createMockCachedCityData(new Date(), context);
  },
};

export { mockCachedCityDataProvider };
