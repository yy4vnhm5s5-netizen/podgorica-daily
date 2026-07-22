import { CalendarDays, Clapperboard, MicVocal, Thermometer } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";

import { getDailyOverviewTranslations } from "@/modules/daily-overview/presentation/daily-overview-translations";
import type { CurrentWeatherResult } from "@/modules/weather/application/get-current-weather";
import { getWeatherTemperature } from "@/modules/weather/presentation/weather-temperature";
import { Card } from "@/shared/components/ui/card";
import type { Locale } from "@/shared/config/locale";
import { getCinemaPath, getEventsPath, getGoingOutPath } from "@/shared/config/public-routes";
import type { City } from "@/shared/types/city";
import { dailySummaryLayout } from "./daily-summary-layout";

interface DailySummaryBarProps {
  city: City;
  eventsCount: number;
  locale: Locale;
  moviesCount: number;
  performancesCount: number;
  weather: CurrentWeatherResult | null;
}

function DailySummaryBar({
  city,
  eventsCount,
  locale,
  moviesCount,
  performancesCount,
  weather,
}: DailySummaryBarProps) {
  const translations = getDailyOverviewTranslations(locale);
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
        <div className={dailySummaryLayout.gridClassName}>
          <span aria-hidden="true" className={dailySummaryLayout.verticalDividerClassName} />
          <span aria-hidden="true" className={dailySummaryLayout.horizontalDividerClassName} />
          <SummaryItem icon={Thermometer} label={translations.temperature}>
            {temperatureCelsius === undefined ? "—" : `${temperatureCelsius.toFixed(0)}°C`}
          </SummaryItem>
          <SummaryItem
            href={getGoingOutPath(city)}
            icon={MicVocal}
            label={translations.performancesLabel}
          >
            {translations.performancesCount(performancesCount)}
          </SummaryItem>
          <SummaryItem
            href={getEventsPath(city)}
            icon={CalendarDays}
            label={translations.eventsLabel}
          >
            {translations.eventsCount(eventsCount)}
          </SummaryItem>
          <SummaryItem
            href={getCinemaPath(city)}
            icon={Clapperboard}
            label={translations.moviesLabel}
          >
            {translations.moviesCount(moviesCount)}
          </SummaryItem>
        </div>
      </Card>
    </section>
  );
}

interface SummaryItemProps {
  children: string;
  href?: string;
  icon: LucideIcon;
  label: string;
}

function SummaryItem({ children, href, icon: Icon, label }: SummaryItemProps) {
  const isInteractive = Boolean(href);
  const content = (
    <>
      <span
        aria-hidden="true"
        className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-blue-100/80 text-blue-800"
      >
        <Icon className="size-3.5" strokeWidth={1.8} />
      </span>
      <span className="min-w-0">
        <span
          className={`block text-xs text-muted-foreground ${isInteractive ? "group-hover:text-foreground" : ""}`}
        >
          {label}
        </span>
        <span
          className={`mt-0.5 block text-sm font-semibold text-foreground ${isInteractive ? "group-hover:text-primary" : ""}`}
        >
          {children}
        </span>
      </span>
    </>
  );

  if (href) {
    return (
      <Link
        className={`${dailySummaryLayout.itemClassName} group cursor-pointer rounded-md transition-[background-color,box-shadow] hover:bg-blue-100/70 hover:shadow-[0_2px_8px_-6px_rgb(30_64_175_/_0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary`}
        href={href}
      >
        {content}
      </Link>
    );
  }

  return <div className={dailySummaryLayout.itemClassName}>{content}</div>;
}

export { DailySummaryBar };
