import { Plane } from "lucide-react";

import { selectUpcomingFlights, type Flight } from "../domain/flight";
import type { FlightCacheState } from "../infrastructure/podgorica-flights";
import {
  getPodgoricaFlightsDisplayState,
  getPodgoricaFlightsUpdatedLabel,
} from "./podgorica-flights-ui-model";
import { Card, CardContent, CardHeader } from "@/shared/components/ui/card";
import { StatusBadge } from "@/shared/components/status-badge";
import type { Locale } from "@/shared/config/locale";
import { getFlightsPath } from "@/shared/config/public-routes";

interface AirportFlightsCardProps {
  flights: readonly Flight[];
  lastSuccessfulRefreshAt?: string;
  locale: Locale;
  state: FlightCacheState;
}

function AirportFlightsCard({
  flights,
  lastSuccessfulRefreshAt,
  locale,
  state,
}: AirportFlightsCardProps) {
  const copy = locale === "me" ? montenegrinCopy : englishCopy;
  const upcoming = selectUpcomingFlights(flights, new Date(), 3);
  const displayState = getPodgoricaFlightsDisplayState({ flightCount: upcoming.length, state });
  const updatedLabel = getPodgoricaFlightsUpdatedLabel({ lastSuccessfulRefreshAt, locale });

  return (
    <Card className="card-fog card-fog--neutral border-primary/15 bg-slate-50/65 transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-[0_12px_24px_-20px_rgb(15_23_42_/_0.32)]">
      <CardHeader className="flex-row items-center gap-3 space-y-0 p-4 sm:p-5">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Plane aria-hidden="true" className="size-[1.125rem]" strokeWidth={1.8} />
        </div>
        <div>
          <h2 className="text-base font-semibold tracking-tight">{copy.title}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{copy.subtitle}</p>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0 sm:p-5 sm:pt-0">
        {displayState === "flights" || displayState === "stale" ? (
          <ul className="divide-y divide-primary/10">
            {upcoming.map((flight) => (
              <AirportFlightRow flight={flight} key={flightKey(flight)} locale={locale} />
            ))}
          </ul>
        ) : (
          <p className="text-sm leading-6 text-muted-foreground">
            {displayState === "unavailable" ? copy.unavailable : copy.empty}
          </p>
        )}
        {displayState === "stale" ? (
          <p className="mt-3 text-xs leading-5 text-muted-foreground">{copy.stale}</p>
        ) : null}
        {updatedLabel ? (
          <p className="mt-3 text-xs leading-5 text-muted-foreground">{updatedLabel}</p>
        ) : null}
        <a
          className="mt-4 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          href={getFlightsPath(locale)}
        >
          {copy.cta}
          <span aria-hidden="true">→</span>
        </a>
      </CardContent>
    </Card>
  );
}

function AirportFlightRow({ flight, locale }: { flight: Flight; locale: Locale }) {
  const copy = locale === "me" ? montenegrinCopy : englishCopy;
  return (
    <li className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0 flex-1">
        <p className="break-words text-sm font-semibold">{flight.location}</p>
        <p className="mt-1 text-sm font-medium tabular-nums text-foreground/85">
          {flight.scheduledTime}
        </p>
        {flight.airline ? (
          <p
            className="mt-0.5 truncate text-xs leading-5 text-muted-foreground"
            title={flight.airline}
          >
            {flight.airline}
          </p>
        ) : null}
      </div>
      <StatusBadge
        className="shrink-0"
        tone={flight.direction === "departure" ? "info" : "neutral"}
      >
        {flight.direction === "departure" ? copy.departure : copy.arrival}
      </StatusBadge>
    </li>
  );
}

function flightKey(flight: Flight) {
  return `${flight.direction}-${flight.scheduledAt}-${flight.flightNumber ?? flight.location}`;
}

const montenegrinCopy = {
  arrival: "Dolazak",
  cta: "Svi letovi",
  departure: "Odlazak",
  empty: "Trenutno nema dostupnih letova.",
  stale: "Prikazani podaci mogu biti zastarjeli.",
  subtitle: "Dolasci i odlasci",
  title: "Aerodrom Podgorica",
  unavailable: "Podaci trenutno nijesu dostupni.",
};
const englishCopy = {
  arrival: "Arrival",
  cta: "All flights",
  departure: "Departure",
  empty: "There are no flights available right now.",
  stale: "Displayed data may be outdated.",
  subtitle: "Arrivals and departures",
  title: "Podgorica Airport",
  unavailable: "Data is temporarily unavailable.",
};

export { AirportFlightsCard, type AirportFlightsCardProps };
