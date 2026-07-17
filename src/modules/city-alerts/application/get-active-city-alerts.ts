import { env } from "@/config/env";
import type { CityAlert } from "@/modules/city-alerts/domain/city-alert";
import {
  getCedisCityAlerts,
  type CityAlertsProviderMode,
} from "@/modules/city-alerts/infrastructure/cedis-city-alerts-provider";

interface CityAlertsMetadata {
  freshnessStatus: "fresh" | "stale" | "unavailable";
  lastSuccessfulUpdate?: Date;
  providerMode: CityAlertsProviderMode;
}

type CityAlertsResult =
  | { data: CityAlert[]; metadata: CityAlertsMetadata; status: "success" }
  | { metadata: CityAlertsMetadata; status: "empty" }
  | { metadata: CityAlertsMetadata; status: "unavailable" }
  | { status: "error" };

interface CityAlertsOverviewAlert {
  isActive: boolean;
  isMajor: boolean;
  severity: "critical" | "information" | "warning";
  type: "powerOutage" | "roadWorks" | "trafficDisruption" | "waterOutage" | "weatherWarning";
}

interface CityAlertsOverviewData {
  alerts: readonly CityAlertsOverviewAlert[];
  freshnessStatus: CityAlertsMetadata["freshnessStatus"];
  providerMode: CityAlertsProviderMode;
  status: "available" | "unavailable";
}

async function getActiveCityAlerts(): Promise<CityAlertsResult> {
  try {
    const source = await getCedisCityAlerts({ mode: env.CEDIS_PROVIDER_MODE });
    const metadata: CityAlertsMetadata = {
      freshnessStatus: source.freshnessStatus,
      lastSuccessfulUpdate: source.lastSuccessfulUpdate,
      providerMode: source.mode,
    };

    if (source.freshnessStatus === "unavailable") {
      return { metadata, status: "unavailable" };
    }

    const activeAlerts = source.alerts.filter(
      ({ status }) => status === "active" || status === "scheduled",
    );
    return activeAlerts.length > 0
      ? { data: activeAlerts, metadata, status: "success" }
      : { metadata, status: "empty" };
  } catch {
    return { status: "error" };
  }
}

async function getCityAlertsOverviewData(): Promise<CityAlertsOverviewData> {
  const result = await getActiveCityAlerts();
  if (result.status === "error" || result.status === "unavailable") {
    return {
      alerts: [],
      freshnessStatus:
        result.status === "unavailable" ? result.metadata.freshnessStatus : "unavailable",
      providerMode: result.status === "unavailable" ? result.metadata.providerMode : "disabled",
      status: "unavailable",
    };
  }

  const alerts = result.status === "success" ? result.data : [];
  return {
    alerts: alerts.flatMap(toOverviewAlert),
    freshnessStatus: result.metadata.freshnessStatus,
    providerMode: result.metadata.providerMode,
    status: "available",
  };
}

function toOverviewAlert(alert: CityAlert): CityAlertsOverviewAlert[] {
  if (alert.severity === "resolved" || alert.type === "emergency") {
    return [];
  }
  return [
    {
      isActive: alert.status === "active",
      isMajor: alert.severity === "critical" || alert.severity === "warning",
      severity: alert.severity,
      type: alert.type,
    },
  ];
}

export {
  getActiveCityAlerts,
  getCityAlertsOverviewData,
  type CityAlertsMetadata,
  type CityAlertsOverviewAlert,
  type CityAlertsOverviewData,
  type CityAlertsResult,
};
