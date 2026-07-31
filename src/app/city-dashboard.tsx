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
  selectHomepageCinemaProgramme,
  selectMoviesWithUpcomingScreenings,
} from "@/modules/events/presentation/cineplexx-programme-ui-model";
import { AirportFlightsCard } from "@/modules/flights/presentation/airport-flights-card";
import { GoingOutSection } from "@/modules/going-out/presentation/going-out-section";
import { getAvailableGoingOutEvents } from "@/modules/going-out/presentation/going-out-ui-model";
import { SeaWaterQualityCard } from "@/modules/sea-water-quality/presentation/sea-water-quality-card";
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
import { getCityDashboardSummaryAvailability, isCityCinemaRouteAvailable } from "@/app/city-routing";
import { LastCityTracker } from "@/app/platform-last-city";
import { isFeatureEnabled } from "@/shared/config/features";
import { getActiveCities } from "@/shared/config/cities";
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
  const { capabilities, events, flights, goingOut, railway, seaWaterQuality, weather } =
    await loadCityDashboardData(context);
  const cinemaEvents = events.events.filter((event) => event.sourceId === "cineplexx-podgorica");
  const now = new Date();
  const cinemaProgramme = selectHomepageCinemaProgramme(cinemaEvents, {
    now,
    timeZone: context.timezone,
  });
  const cityEvents = getCityEventsForPublicListing(events.events);
  const cityEventProviders = events.providers.filter(
    (provider) => provider.id !== "cineplexx-podgorica",
  );
  const homepageCityEvents = getHomepageEvents(cityEvents, context);
  const cityEventsUnavailable = isHomepageEventsUnavailable(cityEventProviders);
  const goingOutCount = goingOut ? getAvailableGoingOutEvents(goingOut.events).length : 0;
  // The full unique-movie count (matching /filmovi), not the ≤3 events selectHomepageCinemaProgramme
  // picked for the compact teaser below — same pattern as eventsCount/homepageCityEvents.slice(0, 3).
  const displayableCinemaMovieCount = selectMoviesWithUpcomingScreenings(cinemaEvents, {
    now,
  }).length;
  const summaryAvailability = getCityDashboardSummaryAvailability(city);
  const cinemaAvailable = isCityCinemaRouteAvailable(city);

  return (
    <DashboardLayout city={city} translations={translations}>
      <LastCityTracker
        activeCityIds={getActiveCities().map((activeCity) => activeCity.id)}
        cityId={city.id}
      />
      <section className="space-y-10 sm:space-y-12" id="dashboard">
        {/* "Today" anchor: the summary bar and Gradske usluge are the two things that most
            directly answer "what's important today," so they share one tighter internal gap
            instead of each taking the same full section beat as the teaser modules below. */}
        <div className="space-y-6">
          <DailySummaryBar
            availability={summaryAvailability}
            city={city}
            eventsCount={homepageCityEvents.length}
            locale={locale}
            moviesCount={displayableCinemaMovieCount}
            performancesCount={goingOutCount}
            seaWaterQualityLocationCount={seaWaterQuality?.summary?.totalLocations}
            weather={weather}
          />
          {isFeatureEnabled("cityAlerts") && capabilities.cityAlerts ? (
            <Suspense fallback={<CityAlertsSectionLoading context={context} locale={locale} />}>
              <CityAlertsSection context={context} locale={locale} />
            </Suspense>
          ) : null}
        </div>
        {seaWaterQuality || goingOut ? (
          <div className="grid items-start gap-6 lg:grid-cols-2">
            {seaWaterQuality ? (
              <SeaWaterQualityCard
                city={city}
                lastSuccessfulRefreshAt={seaWaterQuality.lastSuccessfulRefreshAt}
                locale={locale}
                state={seaWaterQuality.state}
                summary={seaWaterQuality.summary}
              />
            ) : null}
            {goingOut ? (
              <GoingOutSection
                city={city}
                events={goingOut.events}
                locale={locale}
                state={goingOut.state}
              />
            ) : null}
          </div>
        ) : null}
        {capabilities.events ? (
          <div className={cinemaAvailable ? "grid items-start gap-6 lg:grid-cols-2" : undefined}>
            <HomepageEventsCard
              city={city}
              eventCount={homepageCityEvents.length}
              events={homepageCityEvents.slice(0, 3)}
              isUnavailable={cityEventsUnavailable}
              locale={locale}
            />
            {cinemaAvailable ? (
              <div id="bioskop">
                <CineplexxProgrammeCard
                  day={cinemaProgramme.day}
                  events={cinemaProgramme.events}
                  limit={3}
                  locale={locale}
                  state={
                    events.providers.find((provider) => provider.id === "cineplexx-podgorica")
                      ?.state
                  }
                />
              </div>
            ) : null}
          </div>
        ) : null}
        <AdvertisingCard
          href={getContactPath()}
          subtitle={advertising.subtitle}
          title={advertising.title}
        />
        {flights || (isFeatureEnabled("busStation") && railway) ? (
          <div className="grid items-start gap-6 lg:grid-cols-2">
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
        ) : null}
        <EmergencyNumbersStrip
          items={getEmergencyNumbers(emergencyNumbers)}
          label={emergencyNumbers.label}
        />
      </section>
    </DashboardLayout>
  );
}

export { CityDashboard };
