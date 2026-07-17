import type {
  CachedCityDataProvider,
  CityDataSnapshot,
} from "@/modules/daily-overview/domain/daily-overview";

function createMockCachedCityData(now: Date): CityDataSnapshot {
  return {
    airQuality: { data: { category: "good" }, status: "available" },
    alerts: {
      data: [
        { isActive: true, isMajor: false, severity: "warning", type: "roadWorks" },
        { isActive: true, isMajor: false, severity: "information", type: "waterOutage" },
      ],
      status: "available",
    },
    events: { status: "unavailable" },
    generatedAt: now,
    isDemoData: true,
    weather: { data: { temperatureCelsius: 24 }, status: "available" },
  };
}

const mockCachedCityDataProvider: CachedCityDataProvider = {
  async getCachedCityData() {
    return mockCachedCityData;
  },
};

const mockCachedCityData = createMockCachedCityData(new Date());

export { mockCachedCityDataProvider };
