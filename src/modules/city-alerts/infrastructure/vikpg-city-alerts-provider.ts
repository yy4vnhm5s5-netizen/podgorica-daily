import type { CityAlert } from "../domain/city-alert.ts";
import {
  defaultVikpgCachePath,
  readVikpgCache,
  type VikpgCacheSnapshot,
  type VikpgFreshnessStatus,
} from "./vikpg-cache.ts";
import type { CityContext } from "@/shared/types/city";
import type { ProviderMetadata } from "@/shared/types/provider";

type VikpgProviderMode = "disabled" | "live";

interface VikpgCityAlertsSourceData {
  alerts: CityAlert[];
  freshnessStatus: VikpgFreshnessStatus;
  lastSuccessfulUpdate?: Date;
  mode: VikpgProviderMode;
}

async function getVikpgCityAlerts({
  context,
  mode,
  now = () => new Date(),
  readCache = readVikpgCache,
}: {
  context: CityContext;
  mode: VikpgProviderMode;
  now?: () => Date;
  readCache?: () => Promise<VikpgCacheSnapshot | null>;
}): Promise<VikpgCityAlertsSourceData> {
  if (mode === "disabled" || context.city.id !== "podgorica") {
    return { alerts: [], freshnessStatus: "unavailable", mode: "disabled" };
  }
  try {
    const cache = await readCache();
    if (!cache) return { alerts: [], freshnessStatus: "unavailable", mode };
    const currentTime = now();
    return {
      alerts: cache.alerts
        .map((alert) => refreshVikpgAlertStatus(alert, currentTime))
        .filter((alert) => alert.status !== "expired"),
      freshnessStatus: cache.freshnessStatus,
      lastSuccessfulUpdate: new Date(cache.lastSuccessfulRefreshAt),
      mode,
    };
  } catch {
    return { alerts: [], freshnessStatus: "unavailable", mode };
  }
}

function refreshVikpgAlertStatus(alert: CityAlert, now: Date): CityAlert {
  if (alert.status === "expired") return alert;
  if (alert.expectedEndAt && alert.expectedEndAt <= now) return { ...alert, status: "expired" };
  if (alert.startsAt && alert.startsAt > now) return { ...alert, status: "scheduled" };

  const localDate = alert.startsAt ?? alert.publishedAt;
  return localDate && getPodgoricaDateKey(localDate) !== getPodgoricaDateKey(now)
    ? { ...alert, status: "expired" }
    : { ...alert, status: "active" };
}

function getPodgoricaDateKey(value: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Europe/Podgorica",
    year: "numeric",
  }).formatToParts(value);
  const getPart = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${getPart("year")}-${getPart("month")}-${getPart("day")}`;
}

const vikpgProviderMetadata: ProviderMetadata = {
  cachePath: defaultVikpgCachePath,
  displayName: "Vodovod i kanalizacija Podgorica water notices",
  enabled: true,
  id: "vikpg",
  officialSource: "https://vikpg.me/me/mediji/servisne-informacije/obavjestenja.html",
  refreshIntervalMinutes: 60,
  supportsMultipleCities: false,
};

export {
  getVikpgCityAlerts,
  vikpgProviderMetadata,
  type VikpgCityAlertsSourceData,
  type VikpgProviderMode,
};
