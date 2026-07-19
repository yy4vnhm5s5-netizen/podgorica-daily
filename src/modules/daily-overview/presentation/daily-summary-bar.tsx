import { CalendarDays, CloudSun, Clock3, Wind } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import type { DailyOverviewResult } from "@/modules/daily-overview/application/get-daily-overview";
import { getDailyEventsSummary } from "@/modules/daily-overview/presentation/daily-summary-events";
import { getDailyOverviewTranslations } from "@/modules/daily-overview/presentation/daily-overview-translations";
import type { CurrentWeatherResult } from "@/modules/weather/application/get-current-weather";
import { getWeatherTemperature } from "@/modules/weather/presentation/weather-temperature";
import { StatusBadge, type StatusTone } from "@/shared/components/status-badge";
import { Timestamp } from "@/shared/components/timestamp";
import { Card } from "@/shared/components/ui/card";
import type { Locale } from "@/shared/config/locale";
import { getLocaleTag } from "@/shared/config/locale";
import { dailySummaryLayout } from "./daily-summary-layout";

interface DailySummaryBarProps {
  locale: Locale;
  result: DailyOverviewResult;
  weather: CurrentWeatherResult | null;
}

function DailySummaryBar({ locale, result, weather }: DailySummaryBarProps) {
  const translations = getDailyOverviewTranslations(locale);

  if (result.status !== "success") {
    return (
      <section aria-labelledby="daily-summary-heading">
        <h1
          className="mb-2 text-sm font-semibold tracking-tight text-foreground sm:text-base"
          id="daily-summary-heading"
        >
          {translations.summaryLabel}
        </h1>
        <Card className="card-fog card-fog--summary border-blue-200/90 bg-blue-50/60 px-4 py-3 text-sm text-muted-foreground">
          {translations.unavailable}
        </Card>
      </section>
    );
  }

  const { airQualityCategory, eventsToday, generatedAt } = result.data;
  const eventsSummary = getDailyEventsSummary(eventsToday);
  const temperatureCelsius = getWeatherTemperature(weather);

  return (
    <section aria-labelledby="daily-summary-heading">
      <h1
        className="mb-2 text-sm font-semibold tracking-tight text-foreground sm:text-base"
        id="daily-summary-heading"
      >
        {translations.summaryLabel}
      </h1>
      <Card className="card-fog card-fog--summary border-blue-200/90 bg-blue-50/60 px-3 py-2 sm:px-4">
        <span aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-blue-300/80" />
        <dl className={dailySummaryLayout.gridClassName}>
          <span
            aria-hidden="true"
            className={dailySummaryLayout.verticalDividerClassName}
          />
          <span
            aria-hidden="true"
            className={dailySummaryLayout.horizontalDividerClassName}
          />
          <SummaryItem icon={CloudSun} label={translations.temperature}>
            {temperatureCelsius === undefined ? "—" : `${temperatureCelsius.toFixed(0)}°C`}
          </SummaryItem>
          <SummaryItem icon={Wind} label={translations.airQualityLabel}>
            {airQualityCategory ? (
              <StatusBadge tone={airQualityTones[airQualityCategory]}>
                {translations.airQualityCategories[airQualityCategory]}
              </StatusBadge>
            ) : (
              "—"
            )}
          </SummaryItem>
          <SummaryItem icon={CalendarDays} label={translations.eventsLabel}>
            {eventsSummary.status === "unavailable" ? (
              translations.unavailable
            ) : (
              <span className="tabular-nums">{eventsSummary.count}</span>
            )}
          </SummaryItem>
          <SummaryItem icon={Clock3} label={translations.lastUpdated}>
            <Timestamp locale={getLocaleTag(locale)} value={generatedAt} />
          </SummaryItem>
        </dl>
      </Card>
    </section>
  );
}

interface SummaryItemProps {
  children: ReactNode;
  icon: LucideIcon;
  label: string;
}

function SummaryItem({ children, icon: Icon, label }: SummaryItemProps) {
  return (
    <div className={dailySummaryLayout.itemClassName}>
      <Icon aria-hidden="true" className="size-4 shrink-0 text-blue-700" strokeWidth={1.8} />
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="mt-0.5 text-sm font-semibold text-foreground">{children}</dd>
      </div>
    </div>
  );
}

const airQualityTones: Record<"good" | "moderate" | "unhealthy", StatusTone> = {
  good: "success",
  moderate: "warning",
  unhealthy: "error",
};

export { DailySummaryBar };
