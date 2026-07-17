import type {
  CityDataSnapshot,
  ScheduledDataProvider,
} from "@/modules/daily-overview/domain/daily-overview";

type ScheduledProviderKind =
  | "airQuality"
  | "events"
  | "powerOutages"
  | "traffic"
  | "waterOutages"
  | "weather"
  | "weatherWarnings";

interface ScheduledProviderDefinition {
  id: string;
  kind: ScheduledProviderKind;
  refreshIntervalMinutes: number;
}

interface CityDataCache {
  read(): Promise<CityDataSnapshot | null>;
  write(snapshot: CityDataSnapshot): Promise<void>;
}

const scheduledProviderDefinitions: readonly ScheduledProviderDefinition[] = [
  { id: "weather", kind: "weather", refreshIntervalMinutes: 30 },
  { id: "traffic", kind: "traffic", refreshIntervalMinutes: 10 },
  {
    id: "power-outages",
    kind: "powerOutages",
    refreshIntervalMinutes: 10,
  },
  {
    id: "water-outages",
    kind: "waterOutages",
    refreshIntervalMinutes: 10,
  },
  {
    id: "weather-warnings",
    kind: "weatherWarnings",
    refreshIntervalMinutes: 15,
  },
  { id: "events", kind: "events", refreshIntervalMinutes: 60 },
  {
    id: "air-quality",
    kind: "airQuality",
    refreshIntervalMinutes: 60,
  },
];

export {
  scheduledProviderDefinitions,
  type CityDataCache,
  type ScheduledProviderDefinition,
  type ScheduledProviderKind,
  type ScheduledDataProvider,
};
