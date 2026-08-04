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
import { DashboardSection } from "@/shared/components/dashboard/dashboard-section";
import { getEmergencyNumbers } from "@/shared/components/dashboard/emergency-numbers";
import { EmergencyNumbersStrip } from "@/shared/components/dashboard/emergency-numbers-strip";
import { DashboardLayout } from "@/shared/components/layout/dashboard-layout";
import { loadCityDashboardData } from "@/app/city-dashboard-data";
import {
  getCityDashboardSummaryAvailability,
  isCityCinemaRouteAvailable,
} from "@/app/city-routing";
import { LastCityTracker } from "@/app/platform-last-city";
import { isFeatureEnabled } from "@/shared/config/features";
import { getActiveCities } from "@/shared/config/cities";
import { getCinemaPath, getContactPath } from "@/shared/config/public-routes";
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
  const railwayCard = isFeatureEnabled("busStation") && railway;
  const seaWaterCard = seaWaterQuality ? (
    <SeaWaterQualityCard
      city={city}
      lastSuccessfulRefreshAt={seaWaterQuality.lastSuccessfulRefreshAt}
      locale={locale}
      state={seaWaterQuality.state}
      summary={seaWaterQuality.summary}
    />
  ) : null;
  const showSeaWaterBeforeGoingOut = !city.isMain && seaWaterCard !== null;
  const compactModuleCount = [city.isMain ? seaWaterCard : null, flights, railwayCard].filter(
    Boolean,
  ).length;

  return (
    <DashboardLayout city={city} translations={translations}>
      <LastCityTracker
        activeCityIds={getActiveCities().map((activeCity) => activeCity.id)}
        cityId={city.id}
      />
      <section className="space-y-8 sm:space-y-10" id="dashboard">
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
        <div
          className={
            isFeatureEnabled("cityAlerts") && capabilities.cityAlerts
              ? "space-y-4 sm:space-y-5"
              : undefined
          }
        >
          {isFeatureEnabled("cityAlerts") && capabilities.cityAlerts ? (
            <DashboardSection>
              <Suspense fallback={<CityAlertsSectionLoading context={context} locale={locale} />}>
                <CityAlertsSection context={context} locale={locale} />
              </Suspense>
            </DashboardSection>
          ) : null}
          <AdvertisingCard
            href={getContactPath()}
            subtitle={advertising.subtitle}
            title={advertising.title}
          />
        </div>
        {showSeaWaterBeforeGoingOut ? (
          <DashboardSection tone="cyan">{seaWaterCard}</DashboardSection>
        ) : null}
        {goingOut ? (
          <DashboardSection tone="violet">
            <GoingOutSection
              city={city}
              events={goingOut.events}
              locale={locale}
              state={goingOut.state}
            />
          </DashboardSection>
        ) : null}
        {capabilities.events ? (
          <DashboardSection>
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
                    viewAllHref={getCinemaPath(city)}
                  />
                </div>
              ) : null}
            </div>
          </DashboardSection>
        ) : null}
        {compactModuleCount > 0 ? (
          <DashboardSection>
            <div
              className={
                compactModuleCount > 1 ? "grid items-start gap-6 lg:grid-cols-2" : undefined
              }
            >
              {city.isMain ? seaWaterCard : null}
              {flights ? (
                <AirportFlightsCard
                  city={city}
                  flights={flights.flights}
                  lastSuccessfulRefreshAt={flights.lastSuccessfulRefreshAt}
                  locale={locale}
                  state={flights.state}
                />
              ) : null}
              {railwayCard ? (
                <RailwayStationCard
                  departures={railwayCard.departures}
                  locale={locale}
                  state={railwayCard.state}
                />
              ) : null}
            </div>
          </DashboardSection>
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
