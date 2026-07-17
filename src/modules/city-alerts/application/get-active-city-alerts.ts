import { getDefaultCityContext } from "@/config/city-context";
import { getCityAlertProviderData } from "@/config/providers";
import type { CityAlert } from "@/modules/city-alerts/domain/city-alert";
import type { CityContext } from "@/shared/types/city";

type CityAlertsSourceId = "amscg" | "cedis";
type CityAlertsProviderMode = "disabled" | "live" | "mock";

interface CityAlertsSourceMetadata {
  freshnessStatus: "fresh" | "stale" | "unavailable";
  id: CityAlertsSourceId;
  lastSuccessfulUpdate?: Date;
  providerMode: CityAlertsProviderMode;
}

interface CityAlertsMetadata {
  sources: readonly CityAlertsSourceMetadata[];
}

type CityAlertsResult =
  | { data: CityAlert[]; metadata: CityAlertsMetadata; status: "success" }
  | { metadata: CityAlertsMetadata; status: "empty" }
  | { metadata: CityAlertsMetadata; status: "unavailable" }
  | { status: "error" };

interface CityAlertsOverviewAlert {
  isActive: boolean;
  isMajor: boolean;
  isUpcoming: boolean;
  severity: "critical" | "information" | "warning";
  type: "powerOutage" | "roadWorks" | "trafficDisruption" | "waterOutage" | "weatherWarning";
}

interface CityAlertsOverviewData {
  alerts: readonly CityAlertsOverviewAlert[];
  status: "available" | "unavailable";
}

async function getActiveCityAlerts(
  context: CityContext = getDefaultCityContext(),
): Promise<CityAlertsResult> {
  try {
    const [cedis, amscg] = await getCityAlertProviderData(context);
    const sources: CityAlertsSourceMetadata[] = [
      {
        freshnessStatus: cedis.freshnessStatus,
        id: "cedis",
        lastSuccessfulUpdate: cedis.lastSuccessfulUpdate,
        providerMode: cedis.mode,
      },
      {
        freshnessStatus: amscg.freshnessStatus,
        id: "amscg",
        lastSuccessfulUpdate: amscg.lastSuccessfulUpdate,
        providerMode: amscg.mode,
      },
    ];
    const metadata = { sources };
    const sourceAlerts = [...cedis.alerts, ...amscg.alerts];
    const activeAlerts = sourceAlerts.filter(
      ({ status }) => status === "active" || status === "scheduled",
    );

    if (sources.every(({ freshnessStatus }) => freshnessStatus === "unavailable")) {
      return { metadata, status: "unavailable" };
    }
    return activeAlerts.length > 0
      ? { data: activeAlerts, metadata, status: "success" }
      : { metadata, status: "empty" };
  } catch {
    return { status: "error" };
  }
}

async function getCityAlertsOverviewData(
  context: CityContext = getDefaultCityContext(),
): Promise<CityAlertsOverviewData> {
  const result = await getActiveCityAlerts(context);
  if (result.status === "error" || result.status === "unavailable") {
    return { alerts: [], status: "unavailable" };
  }
  return {
    alerts: (result.status === "success" ? result.data : []).flatMap(toOverviewAlert),
    status: "available",
  };
}

function toOverviewAlert(alert: CityAlert): CityAlertsOverviewAlert[] {
  if (alert.severity === "resolved" || alert.type === "emergency") return [];
  return [
    {
      isActive: alert.status === "active",
      isMajor: alert.severity === "critical" || alert.severity === "warning",
      isUpcoming: alert.status === "scheduled",
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
  type CityAlertsSourceMetadata,
};
