type AlertSeverity = "critical" | "information" | "resolved" | "warning";

type AlertType =
  | "emergency"
  | "powerOutage"
  | "roadWorks"
  | "trafficDisruption"
  | "waterOutage"
  | "weatherWarning";

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
  description: CityAlertContent;
  expectedEndAt?: Date;
  id: string;
  severity: AlertSeverity;
  source: CityAlertContent;
  startsAt: Date;
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
