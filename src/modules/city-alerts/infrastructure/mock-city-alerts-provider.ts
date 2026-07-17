import type { CityAlert, CityAlertsProvider } from "@/modules/city-alerts/domain/city-alert";

function getMockCityAlerts(now: Date): CityAlert[] {
  const hour = 60 * 60 * 1000;

  return [
    {
      affectedArea: { key: "centar", kind: "demo" },
      dataMode: "demo",
      description: { key: "roadWorksDescription", kind: "demo" },
      expectedEndAt: new Date(now.getTime() + 6 * hour),
      id: "demo-road-works-centar",
      severity: "warning",
      source: { key: "demoSource", kind: "demo" },
      startsAt: new Date(now.getTime() - hour),
      status: "active",
      title: { key: "roadWorksTitle", kind: "demo" },
      type: "roadWorks",
    },
    {
      affectedArea: { key: "masline", kind: "demo" },
      dataMode: "demo",
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
    {
      affectedArea: { key: "citywide", kind: "demo" },
      dataMode: "demo",
      description: { key: "resolvedDescription", kind: "demo" },
      expectedEndAt: new Date(now.getTime() - hour),
      id: "demo-resolved-citywide",
      severity: "resolved",
      source: { key: "demoSource", kind: "demo" },
      startsAt: new Date(now.getTime() - 5 * hour),
      status: "expired",
      title: { key: "resolvedTitle", kind: "demo" },
      type: "trafficDisruption",
    },
  ];
}

const mockCityAlertsProvider: CityAlertsProvider = {
  async getCityAlerts(): Promise<CityAlert[]> {
    return getMockCityAlerts(new Date());
  },
};

export { mockCityAlertsProvider };
