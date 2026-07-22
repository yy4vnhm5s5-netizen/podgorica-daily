import type { CityAlert, CityAlertsProvider } from "@/modules/city-alerts/domain/city-alert";

function getMockCityAlerts(now: Date): CityAlert[] {
  const hour = 60 * 60 * 1000;

  return [
    {
      affectedArea: { key: "masline", kind: "demo" },
      dataMode: "demo",
      cityIds: ["podgorica"],
      description: { key: "waterOutageDescription", kind: "demo" },
      expectedEndAt: new Date(now.getTime() + 4 * hour),
      id: "demo-water-outage-masline",
      severity: "information",
      source: { key: "demoSource", kind: "demo" },
      startsAt: new Date(now.getTime() - 2 * hour),
      status: "active",
      title: { key: "waterOutageTitle", kind: "demo" },
      type: "waterOutage",
    },
  ];
}

const mockCityAlertsProvider: CityAlertsProvider = {
  async getCityAlerts(): Promise<CityAlert[]> {
    return getMockCityAlerts(new Date());
  },
};

export { mockCityAlertsProvider };
