import { Suspense } from "react";

import { DailySummaryBar } from "@/modules/daily-overview/presentation/daily-summary-bar";
import { CineplexxProgrammeCard } from "@/modules/events/presentation/cineplexx-programme-card";
import { HomepageEventsCard } from "@/modules/events/presentation/homepage-events-card";
import {
  getCityEventsForPublicListing,
  getHomepageEvents,
  isHomepageEventsUnavailable,
} from "@/modules/events/presentation/events-ui-model";
import {
  getDistinctCineplexxMovieCount,
  selectHomepageCinemaProgramme,
} from "@/modules/events/presentation/cineplexx-programme-ui-model";
import { AirportFlightsCard } from "@/modules/flights/presentation/airport-flights-card";
import { GoingOutSection } from "@/modules/going-out/presentation/going-out-section";
import { getAvailableGoingOutEvents } from "@/modules/going-out/presentation/going-out-ui-model";
import { RailwayStationCard } from "@/modules/transport/presentation/railway-station-card";
import {
  CityAlertsSection,
  CityAlertsSectionLoading,
} from "@/modules/city-alerts/presentation/city-alerts-section";
import { AdvertisingCard } from "@/shared/components/dashboard/advertising-card";
import { getEmergencyNumbers } from "@/shared/components/dashboard/emergency-numbers";
import { EmergencyNumbersStrip } from "@/shared/components/dashboard/emergency-numbers-strip";
import { DashboardLayout } from "@/shared/components/layout/dashboard-layout";
import { loadCityDashboardData } from "@/app/city-dashboard-data";
import { isFeatureEnabled } from "@/shared/config/features";
import { getContactPath } from "@/shared/config/public-routes";
import type { CityContext } from "@/shared/types/city";
import { getTranslations } from "@/shared/lib/translations";

interface CityDashboardProps {
  context: CityContext;
}

async function CityDashboard({ context }: CityDashboardProps) {
  const { city, locale } = context;
  const translations = getTranslations(locale);
  const { advertising, emergencyNumbers } = translations.dashboard;
  const { capabilities, events, flights, goingOut, railway, weather } =
    await loadCityDashboardData(context);
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
  const goingOutCount = goingOut ? getAvailableGoingOutEvents(goingOut.events).length : 0;
  const cinemaMovieCount = getDistinctCineplexxMovieCount(cinemaEvents);

  return (
    <DashboardLayout city={city} translations={translations}>
      <section className="space-y-10" id="dashboard">
        <div className="space-y-7">
          <DailySummaryBar
            city={city}
            eventsCount={homepageCityEvents.length}
            locale={locale}
            moviesCount={cinemaMovieCount}
            performancesCount={goingOutCount}
            weather={weather}
          />
          {isFeatureEnabled("cityAlerts") && capabilities.cityAlerts ? (
            <Suspense fallback={<CityAlertsSectionLoading context={context} locale={locale} />}>
              <CityAlertsSection context={context} locale={locale} />
            </Suspense>
          ) : null}
          <AdvertisingCard
            href={getContactPath()}
            subtitle={advertising.subtitle}
            title={advertising.title}
          />
          {goingOut ? (
            <GoingOutSection
              city={city}
              events={goingOut.events}
              locale={locale}
              state={goingOut.state}
            />
          ) : null}
        </div>
        <div className="grid items-start gap-5 sm:grid-cols-2">
          {capabilities.events ? (
            <>
              <HomepageEventsCard
                city={city}
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
                    events.providers.find((provider) => provider.id === "cineplexx-podgorica")
                      ?.state
                  }
                />
              </div>
            </>
          ) : null}
          <div className="sm:col-span-2">
            <AdvertisingCard
              href={getContactPath()}
              subtitle={advertising.subtitle}
              title={advertising.title}
            />
          </div>
          {flights ? (
            <AirportFlightsCard
              city={city}
              flights={flights.flights}
              lastSuccessfulRefreshAt={flights.lastSuccessfulRefreshAt}
              locale={locale}
              state={flights.state}
            />
          ) : null}
          {isFeatureEnabled("busStation") && railway ? (
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

export { CityDashboard };
