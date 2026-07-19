import { Suspense } from "react";
import { notFound } from "next/navigation";

import { getDefaultCityContext } from "@/config/city-context";
import { getDailyOverview } from "@/modules/daily-overview/application/get-daily-overview";
import { DailySummaryBar } from "@/modules/daily-overview/presentation/daily-summary-bar";
import { getCityEvents } from "@/modules/events/application/get-city-events";
import { HomepageEventsCard } from "@/modules/events/presentation/homepage-events-card";
import { selectHomepageEvents } from "@/modules/events/presentation/events-ui-model";
import { getCurrentWeather } from "@/modules/weather/application/get-current-weather";
import {
  CurrentWeatherCard,
  CurrentWeatherCardLoading,
} from "@/modules/weather/presentation/current-weather-card";
import {
  CityAlertsSection,
  CityAlertsSectionLoading,
} from "@/modules/city-alerts/presentation/city-alerts-section";
import { AdvertisingCard } from "@/shared/components/dashboard/advertising-card";
import { CinemaPlaceholderCard } from "@/shared/components/dashboard/cinema-placeholder-card";
import { getEmergencyNumbers } from "@/shared/components/dashboard/emergency-numbers";
import { EmergencyNumbersStrip } from "@/shared/components/dashboard/emergency-numbers-strip";
import { DashboardLayout } from "@/shared/components/layout/dashboard-layout";
import { isLocale, type Locale } from "@/shared/config/locale";
import { isFeatureEnabled } from "@/shared/config/features";
import { getTranslations } from "@/shared/lib/translations";

interface LocalePageProps {
  params: Promise<{ locale: string }>;
}

// Keep the route fresh enough to reflect newly collected cache snapshots without
// opting every route in the application out of Next.js caching.
export const revalidate = 60;

async function LocalePage({ params }: LocalePageProps) {
  const { locale: localeParam } = await params;

  if (!isLocale(localeParam)) {
    notFound();
  }

  return <DashboardPage locale={localeParam} />;
}

async function DashboardPage({ locale }: { locale: Locale }) {
  const translations = getTranslations(locale);
  const { advertising, cards, emergencyNumbers } = translations.dashboard;
  const context = getDefaultCityContext(locale);
  const [dailyOverview, events, weather] = await Promise.all([
    isFeatureEnabled("dailyOverview") ? getDailyOverview(context) : null,
    getCityEvents(context),
    isFeatureEnabled("weather") ? getCurrentWeather(context) : null,
  ]);

  return (
    <DashboardLayout locale={locale} translations={translations}>
      <section className="space-y-10" id="dashboard">
        <div className="space-y-7">
          {dailyOverview ? <DailySummaryBar locale={locale} result={dailyOverview} weather={weather} /> : null}
          {isFeatureEnabled("cityAlerts") ? (
            <Suspense fallback={<CityAlertsSectionLoading locale={locale} />}>
              <CityAlertsSection locale={locale} />
            </Suspense>
          ) : null}
          <AdvertisingCard subtitle={advertising.subtitle} title={advertising.title} />
        </div>
        <div className="grid items-start gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {weather ? (
            <Suspense fallback={<CurrentWeatherCardLoading locale={locale} />}>
              <CurrentWeatherCard locale={locale} result={weather} />
            </Suspense>
          ) : null}
          <HomepageEventsCard
            events={selectHomepageEvents(events.events, context)}
            locale={locale}
          />
          <CinemaPlaceholderCard
            actionLabel={cards.cinemaAction}
            description={cards.cinemaDescription}
            title={cards.cinema}
          />
        </div>
        <EmergencyNumbersStrip items={getEmergencyNumbers(emergencyNumbers)} label={emergencyNumbers.label} />
      </section>
    </DashboardLayout>
  );
}

export default LocalePage;
