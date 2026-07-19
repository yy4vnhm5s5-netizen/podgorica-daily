import { type Locale } from "../../../shared/config/locale.ts";
import { formatRelativeTime } from "../../../shared/lib/date.ts";

type CityServiceFreshnessStatus = "fresh" | "stale" | "unavailable";

function getCityServiceFreshnessLabel({
  freshnessStatus,
  lastSuccessfulUpdate,
  locale,
  now,
  translations,
}: {
  freshnessStatus: CityServiceFreshnessStatus;
  lastSuccessfulUpdate?: Date;
  locale: Locale;
  now: Date;
  translations: { lastAvailableUpdate: string; updated: string };
}) {
  if (freshnessStatus === "unavailable" || !lastSuccessfulUpdate) return undefined;

  const prefix = freshnessStatus === "stale" ? translations.lastAvailableUpdate : translations.updated;
  return `${prefix} ${formatRelativeTime(lastSuccessfulUpdate, { locale, now })}`;
}

export { getCityServiceFreshnessLabel, type CityServiceFreshnessStatus };
