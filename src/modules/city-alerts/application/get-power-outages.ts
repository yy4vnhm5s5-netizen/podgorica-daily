import { getCityAlertProviderData } from "@/config/providers";
import type { CityAlert } from "@/modules/city-alerts/domain/city-alert";
import { getRelevantPowerOutages } from "./power-outage-selection.ts";
import type { CityContext } from "@/shared/types/city";

type PowerOutagesReadResult =
  | {
      freshnessStatus: "fresh" | "stale";
      lastSuccessfulUpdate?: Date;
      outages: readonly CityAlert[];
      status: "available" | "empty";
    }
  | {
      freshnessStatus: "unavailable";
      outages: readonly CityAlert[];
      status: "unavailable";
    };

interface CedisPowerOutageData {
  alerts: readonly CityAlert[];
  freshnessStatus: "fresh" | "stale" | "unavailable";
  lastSuccessfulUpdate?: Date;
}

interface GetPowerOutagesDependencies {
  getCedisData?: (context: CityContext) => Promise<CedisPowerOutageData>;
}

async function getPowerOutages(
  context: CityContext,
  { getCedisData = getDefaultCedisData }: GetPowerOutagesDependencies = {},
): Promise<PowerOutagesReadResult> {
  try {
    const cedis = await getCedisData(context);
    if (cedis.freshnessStatus === "unavailable") {
      return { freshnessStatus: "unavailable", outages: [], status: "unavailable" };
    }

    const outages = getRelevantPowerOutages(cedis.alerts);
    return {
      freshnessStatus: cedis.freshnessStatus,
      ...(cedis.lastSuccessfulUpdate ? { lastSuccessfulUpdate: cedis.lastSuccessfulUpdate } : {}),
      outages,
      status: outages.length > 0 ? "available" : "empty",
    };
  } catch {
    return { freshnessStatus: "unavailable", outages: [], status: "unavailable" };
  }
}

async function getDefaultCedisData(context: CityContext): Promise<CedisPowerOutageData> {
  const [cedis] = await getCityAlertProviderData(context);
  return cedis;
}

export {
  getPowerOutages,
  type CedisPowerOutageData,
  type GetPowerOutagesDependencies,
  type PowerOutagesReadResult,
};
