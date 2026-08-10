import { Plane, PlaneLanding, PlaneTakeoff } from "lucide-react";

import type { Flight } from "../domain/flight";
import type { AirportFlightsSource } from "../infrastructure/airport-flights-config";
import type { FlightCacheState } from "../infrastructure/podgorica-flights";
import {
  getDisplayableFlightFact,
  getAirportFlightsDisplayState,
  getAirportFlightsUpdatedLabel,
  getUpcomingAirportFlightGroups,
} from "./podgorica-flights-ui-model";
import { CityFeatureDiscovery } from "@/shared/components/city-feature-discovery";
import { EmptyState } from "@/shared/components/empty-state";
import { ErrorState } from "@/shared/components/error-state";
import { NewTabNotice } from "@/shared/components/new-tab-notice";
import { SectionTitle } from "@/shared/components/section-title";
import { StatusBadge } from "@/shared/components/status-badge";
import { Card, CardContent } from "@/shared/components/ui/card";
import { getLocaleTag, type Locale } from "@/shared/config/locale";
import { formatDateTime } from "@/shared/lib/date";
import type { City } from "@/shared/types/city";

interface AirportFlightsPageProps {
  airport: AirportFlightsSource;
  city: City;
  flights: readonly Flight[];
  lastSuccessfulRefreshAt?: string;
  locale: Locale;
  state: FlightCacheState;
}

function AirportFlightsPage({
  airport,
  city,
  flights,
  lastSuccessfulRefreshAt,
  locale,
  state,
}: AirportFlightsPageProps) {
  const copy = locale === "me" ? montenegrinCopy : englishCopy;
  const title = airport.displayName;
  const description = copy.description(airport.displayName);
  const groups = getUpcomingAirportFlightGroups(flights, new Date(), 5);
  const displayState = getAirportFlightsDisplayState({
    flightCount: groups.arrival.length + groups.departure.length,
    state,
  });
  const updatedLabel = getAirportFlightsUpdatedLabel({ lastSuccessfulRefreshAt, locale });

  return (
    <section aria-labelledby="flights-heading" className="space-y-6" id="flights">
      <div className="space-y-2">
        <SectionTitle
          as="h1"
          icon={Plane}
          iconClassName="bg-gradient-to-br from-sky-400 to-sky-600 text-white shadow-sky-900/20"
          id="flights-heading"
          title={title}
        />
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      {displayState === "unavailable" ? (
        <ErrorState description={copy.unavailable} title={title} />
      ) : displayState === "empty" ? (
        <EmptyState description={copy.empty} title={title} />
      ) : (
        <div className="space-y-8">
          {displayState === "stale" || displayState === "stale-empty" ? (
            <p
              className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
              role="status"
            >
              {copy.stale}
            </p>
          ) : null}
          {updatedLabel ? (
            <p className="text-xs leading-5 text-muted-foreground">{updatedLabel}</p>
          ) : null}
          {displayState === "stale-empty" ? (
            <EmptyState description={copy.staleEmpty} title={title} />
          ) : (
            <>
              <FlightGroup
                flights={groups.departure}
                icon={PlaneTakeoff}
                id="flight-departures"
                locale={locale}
                title={copy.departures}
              />
              <FlightGroup
                flights={groups.arrival}
                icon={PlaneLanding}
                id="flight-arrivals"
                locale={locale}
                title={copy.arrivals}
              />
            </>
          )}
        </div>
      )}
      <a
        className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        href={airport.officialPageUrl}
        rel="noopener noreferrer"
        target="_blank"
      >
        {copy.source}
        <NewTabNotice locale={locale} />
      </a>
      <CityFeatureDiscovery city={city} currentFeature="flights" />
    </section>
  );
}

function FlightGroup({
  flights,
  icon: Icon,
  id,
  locale,
  title,
}: {
  flights: readonly Flight[];
  icon: typeof PlaneTakeoff;
  id: string;
  locale: Locale;
  title: string;
}) {
  if (flights.length === 0) return null;

  return (
    <section aria-labelledby={id} className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon aria-hidden="true" className="size-4 text-sky-600" strokeWidth={1.8} />
        <h2 className="text-lg font-semibold tracking-tight" id={id}>
          {title}
        </h2>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {flights.map((flight) => (
          <FlightCard
            flight={flight}
            key={`${flight.direction}-${flight.scheduledAt}-${flight.flightNumber ?? flight.location}`}
            locale={locale}
          />
        ))}
      </div>
    </section>
  );
}

function FlightCard({ flight, locale }: { flight: Flight; locale: Locale }) {
  const copy = locale === "me" ? montenegrinCopy : englishCopy;
  const airline = getDisplayableFlightFact(flight.airline);
  const dateLabel = formatDateTime(new Date(flight.scheduledAt), {
    formatOptions: { dateStyle: "medium", timeStyle: undefined },
    locale: getLocaleTag(locale),
  }).label;
  const status = getDisplayableFlightFact(flight.status);

  return (
    <Card className="border-primary/15 bg-slate-50/65 shadow-none">
      <CardContent className="space-y-3 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="break-words text-base font-semibold">{flight.location}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {dateLabel} • {flight.scheduledTime}
            </p>
          </div>
          <StatusBadge tone={flight.direction === "departure" ? "info" : "neutral"}>
            {flight.direction === "departure" ? copy.departure : copy.arrival}
          </StatusBadge>
        </div>
        <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
          {airline ? <FlightValue label={copy.airline} value={airline} /> : null}
          {flight.flightNumber ? (
            <FlightValue label={copy.flightNumber} value={flight.flightNumber} />
          ) : null}
          {status ? <FlightValue label={copy.status} value={status} /> : null}
        </dl>
      </CardContent>
    </Card>
  );
}

function FlightValue({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words font-medium">{value}</dd>
    </div>
  );
}

const montenegrinCopy = {
  airline: "Avio-kompanija",
  arrival: "Dolazak",
  arrivals: "Dolasci",
  departure: "Odlazak",
  departures: "Odlasci",
  description: (airportName: string) =>
    `Aktuelni red letenja za ${airportName} — dolasci i odlasci iz zvaničnih podataka Aerodroma Crne Gore.`,
  empty: "Trenutno nema dostupnih letova.",
  flightNumber: "Broj leta",
  stale: "Prikazani podaci mogu biti zastarjeli.",
  staleEmpty: "Nema narednih letova u posljednjem dostupnom redu letenja.",
  status: "Status",
  source: "Kompletan red letenja na sajtu Aerodroma Crne Gore ↗",
  unavailable: "Podaci trenutno nijesu dostupni.",
};
const englishCopy = {
  airline: "Airline",
  arrival: "Arrival",
  arrivals: "Arrivals",
  departure: "Departure",
  departures: "Departures",
  description: (airportName: string) =>
    `Current ${airportName} schedule — arrivals and departures from official Airports of Montenegro data.`,
  empty: "There are no flights available right now.",
  flightNumber: "Flight number",
  stale: "Displayed data may be outdated.",
  staleEmpty: "There are no upcoming flights in the last available schedule.",
  status: "Status",
  source: "Full flight schedule on the Airports of Montenegro website ↗",
  unavailable: "Data is temporarily unavailable.",
};

export { AirportFlightsPage, type AirportFlightsPageProps };
