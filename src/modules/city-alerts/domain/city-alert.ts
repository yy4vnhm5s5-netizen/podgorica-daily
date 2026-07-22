import type { CityId } from "@/shared/types/city";

type AlertSeverity = "critical" | "information" | "resolved" | "warning";

type AlertType = "emergency" | "powerOutage" | "waterOutage" | "weatherWarning";

type CityAlertContent =
  | {
      key: string;
      kind: "demo";
    }
  | {
      kind: "source";
      value: string;
    };

interface CityAlert {
  affectedArea: CityAlertContent;
  dataMode: "demo" | "live";
  cityIds: CityId[];
  description: CityAlertContent;
  expectedEndAt?: Date;
  id: string;
  publishedAt?: Date;
  rawSourceText?: string;
  severity: AlertSeverity;
  source: CityAlertContent;
  sourceUrl?: string;
  startsAt?: Date;
  status: "active" | "expired" | "scheduled";
  title: CityAlertContent;
  type: AlertType;
}

interface CityAlertsProvider {
  getCityAlerts(): Promise<CityAlert[] | null>;
}

export {
  type AlertSeverity,
  type AlertType,
  type CityAlert,
  type CityAlertContent,
  type CityAlertsProvider,
};
