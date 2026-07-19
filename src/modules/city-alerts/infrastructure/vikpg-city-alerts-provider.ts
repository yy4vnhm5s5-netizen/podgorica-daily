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
  readCache = readVikpgCache,
}: {
  context: CityContext;
  mode: VikpgProviderMode;
  readCache?: () => Promise<VikpgCacheSnapshot | null>;
}): Promise<VikpgCityAlertsSourceData> {
  if (mode === "disabled" || context.city.id !== "podgorica") {
    return { alerts: [], freshnessStatus: "unavailable", mode: "disabled" };
  }
  try {
    const cache = await readCache();
    if (!cache) return { alerts: [], freshnessStatus: "unavailable", mode };
    return {
      alerts: cache.alerts,
      freshnessStatus: cache.freshnessStatus,
      lastSuccessfulUpdate: new Date(cache.lastSuccessfulRefreshAt),
      mode,
    };
  } catch {
    return { alerts: [], freshnessStatus: "unavailable", mode };
  }
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
