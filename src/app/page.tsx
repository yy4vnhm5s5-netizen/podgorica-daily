import { Suspense } from "react";

import { getDefaultCityContext } from "@/config/city-context";
import { getDailyOverview } from "@/modules/daily-overview/application/get-daily-overview";
import { DailySummaryBar } from "@/modules/daily-overview/presentation/daily-summary-bar";
import { getCityEvents } from "@/modules/events/application/get-city-events";
import { CineplexxProgrammeCard } from "@/modules/events/presentation/cineplexx-programme-card";
import { HomepageEventsCard } from "@/modules/events/presentation/homepage-events-card";
import {
  getCityEventsForPublicListing,
  getHomepageEvents,
  getHomepageEventsTodayCount,
  isHomepageEventsUnavailable,
} from "@/modules/events/presentation/events-ui-model";
import { selectHomepageCinemaProgramme } from "@/modules/events/presentation/cineplexx-programme-ui-model";
import { getPodgoricaFlights } from "@/modules/flights/application/get-podgorica-flights";
import { AirportFlightsCard } from "@/modules/flights/presentation/airport-flights-card";
import { getGoingOutEvents } from "@/modules/going-out/application/get-going-out-events";
import { GoingOutSection } from "@/modules/going-out/presentation/going-out-section";
import { getRailwayDepartures } from "@/modules/transport/application/get-railway-departures";
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
import { isFeatureEnabled } from "@/shared/config/features";
import { getContactPath } from "@/shared/config/public-routes";
import { getTranslations } from "@/shared/lib/translations";

// Event, alert, and transport data is read from collector-managed local snapshots.
// Rendering this route dynamically keeps every public event link aligned with the
// current snapshot instead of serving a stale Full Route Cache entry after a refresh.
// External weather fetching retains its own explicit ten-minute Data Cache policy.
export const revalidate = 0;

async function HomePage() {
  const locale = "me" as const;
  const translations = getTranslations(locale);
  const { advertising, emergencyNumbers } = translations.dashboard;
  const context = getDefaultCityContext(locale);
  const [dailyOverview, events, flights, goingOut, railway, weather] = await Promise.all([
    isFeatureEnabled("dailyOverview") ? getDailyOverview(context) : null,
    getCityEvents(context),
    isFeatureEnabled("flights") ? getPodgoricaFlights() : null,
    isFeatureEnabled("goingOut") ? getGoingOutEvents() : null,
    getRailwayDepartures(),
    isFeatureEnabled("weather") ? getCurrentWeather(context) : null,
  ]);
  const cinemaEvents = events.events.filter((event) => event.sourceId === "cineplexx-podgorica");
  const cinemaProgramme = selectHomepageCinemaProgramme(cinemaEvents, {
    now: new Date(),
    timeZone: context.timezone,
  });
  const cityEvents = getCityEventsForPublicListing(events.events);
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
    <DashboardLayout translations={translations}>
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
            href={getContactPath()}
            subtitle={advertising.subtitle}
            title={advertising.title}
          />
          {goingOut ? (
            <GoingOutSection events={goingOut.events} locale={locale} state={goingOut.state} />
          ) : null}
        </div>
        <div className="grid items-start gap-5 sm:grid-cols-2">
          <HomepageEventsCard
            eventCount={homepageCityEvents.length}
            events={homepageCityEvents.slice(0, 3)}
            isUnavailable={cityEventsUnavailable}
            locale={locale}
          />
          <div id="bioskop">
            <CineplexxProgrammeCard
              day={cinemaProgramme.day}
              events={cinemaProgramme.events}
              locale={locale}
              state={
                events.providers.find((provider) => provider.id === "cineplexx-podgorica")?.state
              }
            />
          </div>
          <div className="sm:col-span-2">
            <AdvertisingCard
              href={getContactPath()}
              subtitle={advertising.subtitle}
              title={advertising.title}
            />
          </div>
          {flights ? (
            <AirportFlightsCard
              flights={flights.flights}
              lastSuccessfulRefreshAt={flights.lastSuccessfulRefreshAt}
              locale={locale}
              state={flights.state}
            />
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

export default HomePage;
