import { Suspense } from "react";
import { notFound } from "next/navigation";

import { getDefaultCityContext } from "@/config/city-context";
import { getDailyOverview } from "@/modules/daily-overview/application/get-daily-overview";
import { DailySummaryBar } from "@/modules/daily-overview/presentation/daily-summary-bar";
import { getCityEvents } from "@/modules/events/application/get-city-events";
import { CineplexxProgrammeCard } from "@/modules/events/presentation/cineplexx-programme-card";
import { HomepageEventsCard } from "@/modules/events/presentation/homepage-events-card";
import {
  getHomepageEvents,
  getHomepageEventsTodayCount,
  isHomepageEventsUnavailable,
  selectHomepageEvents,
} from "@/modules/events/presentation/events-ui-model";
import { getRailwayDepartures } from "@/modules/transport/application/get-railway-departures";
import { BusStationCard } from "@/modules/transport/presentation/bus-station-card";
import { RailwayStationCard } from "@/modules/transport/presentation/railway-station-card";
import { getCurrentWeather } from "@/modules/weather/application/get-current-weather";
import {
  CityAlertsSection,
  CityAlertsSectionLoading,
} from "@/modules/city-alerts/presentation/city-alerts-section";
import { AdvertisingCard } from "@/shared/components/dashboard/advertising-card";
import { getEmergencyNumbers } from "@/shared/components/dashboard/emergency-numbers";
import { EmergencyNumbersStrip } from "@/shared/components/dashboard/emergency-numbers-strip";
import { DashboardLayout } from "@/shared/components/layout/dashboard-layout";
import { isLocale, type Locale } from "@/shared/config/locale";
import { isFeatureEnabled } from "@/shared/config/features";
import { getContactPath } from "@/shared/config/public-routes";
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
  const { advertising, emergencyNumbers } = translations.dashboard;
  const context = getDefaultCityContext(locale);
  const [dailyOverview, events, railway, weather] = await Promise.all([
    isFeatureEnabled("dailyOverview") ? getDailyOverview(context) : null,
    getCityEvents(context),
    getRailwayDepartures(),
    isFeatureEnabled("weather") ? getCurrentWeather(context) : null,
  ]);
  const cinemaEvents = events.events.filter((event) => event.sourceId === "cineplexx-podgorica");
  const cityEvents = events.events.filter((event) => event.sourceId !== "cineplexx-podgorica");
  const cityEventProviders = events.providers.filter(
    (provider) => provider.id !== "cineplexx-podgorica",
  );
  const homepageCityEvents = getHomepageEvents(cityEvents, context);
  const cityEventsUnavailable = isHomepageEventsUnavailable(cityEventProviders);
  const dailyEvents = {
    isUnavailable: cityEventsUnavailable,
    todayCount: getHomepageEventsTodayCount(homepageCityEvents, context.timezone),
    upcomingCount: homepageCityEvents.length,
  };

  return (
    <DashboardLayout locale={locale} translations={translations}>
      <section className="space-y-10" id="dashboard">
        <div className="space-y-7">
          {dailyOverview ? (
            <DailySummaryBar
              events={dailyEvents}
              locale={locale}
              result={dailyOverview}
              weather={weather}
            />
          ) : null}
          {isFeatureEnabled("cityAlerts") ? (
            <Suspense fallback={<CityAlertsSectionLoading locale={locale} />}>
              <CityAlertsSection locale={locale} />
            </Suspense>
          ) : null}
          <AdvertisingCard
            href={getContactPath(locale)}
            subtitle={advertising.subtitle}
            title={advertising.title}
          />
        </div>
        <div className="grid items-start gap-5 sm:grid-cols-2">
          <HomepageEventsCard
            eventCount={homepageCityEvents.length}
            events={homepageCityEvents.slice(0, 3)}
            isUnavailable={cityEventsUnavailable}
            locale={locale}
          />
          <CineplexxProgrammeCard
            events={selectHomepageEvents(cinemaEvents, context)}
            locale={locale}
            state={
              events.providers.find((provider) => provider.id === "cineplexx-podgorica")?.state
            }
          />
          {isFeatureEnabled("busStation") ? (
            <BusStationCard city={context.city} locale={locale} />
          ) : null}
          {isFeatureEnabled("busStation") ? (
            <RailwayStationCard
              departures={railway.departures}
              locale={locale}
              state={railway.state}
            />
          ) : null}
        </div>
        <EmergencyNumbersStrip
          items={getEmergencyNumbers(emergencyNumbers)}
          label={emergencyNumbers.label}
        />
      </section>
    </DashboardLayout>
  );
}

export default LocalePage;
