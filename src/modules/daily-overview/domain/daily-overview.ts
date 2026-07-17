import type { CityContext, CityId } from "@/shared/types/city";

type OverviewLocale = "en" | "me";

type DataAvailability<T> = { data: T; status: "available" } | { status: "unavailable" };

type OverviewAlertType =
  "powerOutage" | "roadWorks" | "trafficDisruption" | "waterOutage" | "weatherWarning";

type OverviewAlertSeverity = "critical" | "information" | "warning";

interface OverviewAlert {
  isActive: boolean;
  isUpcoming?: boolean;
  isMajor: boolean;
  severity: OverviewAlertSeverity;
  type: OverviewAlertType;
}

interface WeatherOverviewData {
  temperatureCelsius: number;
}

interface EventsOverviewData {
  count: number;
}

type AirQualityCategory = "good" | "moderate" | "unhealthy";

interface AirQualityOverviewData {
  category: AirQualityCategory;
}

interface CityDataSnapshot {
  airQuality: DataAvailability<AirQualityOverviewData>;
  alerts: DataAvailability<readonly OverviewAlert[]>;
  cityIds: CityId[];
  events: DataAvailability<EventsOverviewData>;
  generatedAt: Date;
  isDemoData: boolean;
  weather: DataAvailability<WeatherOverviewData>;
}

interface DailyOverview {
  generatedAt: Date;
  isDemoData: boolean;
  sentences: readonly string[];
}

interface CachedCityDataProvider {
  getCachedCityData(context: CityContext): Promise<CityDataSnapshot | null>;
}

interface ScheduledDataProvider {
  id: string;
  refreshIntervalMinutes: number;
  refreshCachedData(): Promise<void>;
}

export {
  type AirQualityCategory,
  type AirQualityOverviewData,
  type CachedCityDataProvider,
  type CityDataSnapshot,
  type DailyOverview,
  type DataAvailability,
  type EventsOverviewData,
  type OverviewAlert,
  type OverviewAlertSeverity,
  type OverviewAlertType,
  type OverviewLocale,
  type ScheduledDataProvider,
  type WeatherOverviewData,
};
