"use client";

import { Plane, PlaneLanding, PlaneTakeoff } from "lucide-react";
import { useId, useState, type KeyboardEvent } from "react";

import type { Flight } from "../domain/flight";
import type { FlightCacheState } from "../infrastructure/podgorica-flights";
import {
  getUpcomingPodgoricaFlightGroups,
  getPodgoricaFlightsDisplayState,
  getPodgoricaFlightsUpdatedLabel,
  type FlightDirectionGroup,
} from "./podgorica-flights-ui-model";
import { Card, CardContent, CardHeader } from "@/shared/components/ui/card";
import { StatusBadge } from "@/shared/components/status-badge";
import type { Locale } from "@/shared/config/locale";
import { getFlightsPath } from "@/shared/config/public-routes";
import { cn } from "@/shared/lib/utils";

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
  const [selectedDirection, setSelectedDirection] = useState<FlightDirectionGroup>("arrival");
  const panelId = useId();
  const upcoming = getUpcomingPodgoricaFlightGroups(flights, new Date(), 3);
  const selectedFlights = upcoming[selectedDirection];
  const displayState = getPodgoricaFlightsDisplayState({
    flightCount: selectedFlights.length,
    state,
  });
  const updatedLabel = getPodgoricaFlightsUpdatedLabel({ lastSuccessfulRefreshAt, locale });
  const tabs: readonly FlightDirectionGroup[] = ["arrival", "departure"];

  function selectDirection(direction: FlightDirectionGroup) {
    setSelectedDirection(direction);
    document.getElementById(`${panelId}-${direction}`)?.focus();
  }

  function handleTabKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    direction: FlightDirectionGroup,
  ) {
    const index = tabs.indexOf(direction);
    const nextDirection = tabs[(index + 1) % tabs.length];
    const previousDirection = tabs[(index - 1 + tabs.length) % tabs.length];

    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      selectDirection(nextDirection);
    }

    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      selectDirection(previousDirection);
    }

    if (event.key === "Home") {
      event.preventDefault();
      selectDirection(tabs[0]);
    }

    if (event.key === "End") {
      event.preventDefault();
      selectDirection(tabs[tabs.length - 1]);
    }
  }

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
        <div
          aria-label={copy.tabsLabel}
          className="mb-4 flex gap-1 rounded-lg border border-primary/10 bg-background/60 p-1"
          role="tablist"
        >
          {tabs.map((direction) => {
            const Icon = direction === "arrival" ? PlaneLanding : PlaneTakeoff;
            const isSelected = selectedDirection === direction;

            return (
              <button
                aria-controls={panelId}
                aria-selected={isSelected}
                className={cn(
                  "focus-visible:ring-ring flex min-h-10 flex-1 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                  isSelected
                    ? "border border-primary/15 bg-background text-foreground shadow-[0_2px_5px_-4px_rgb(15_23_42_/_0.3)]"
                    : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
                )}
                id={`${panelId}-${direction}`}
                key={direction}
                onClick={() => setSelectedDirection(direction)}
                onKeyDown={(event) => handleTabKeyDown(event, direction)}
                role="tab"
                type="button"
              >
                <Icon aria-hidden="true" className="size-4 text-primary" strokeWidth={1.8} />
                {direction === "arrival" ? copy.arrivals : copy.departures}
              </button>
            );
          })}
        </div>
        {displayState === "flights" || displayState === "stale" ? (
          <ul
            aria-labelledby={`${panelId}-${selectedDirection}`}
            className="divide-y divide-primary/10"
            id={panelId}
            role="tabpanel"
          >
            {selectedFlights.map((flight) => (
              <AirportFlightRow flight={flight} key={flightKey(flight)} locale={locale} />
            ))}
          </ul>
        ) : (
          <div aria-labelledby={`${panelId}-${selectedDirection}`} id={panelId} role="tabpanel">
            <p className="text-sm leading-6 text-muted-foreground">
              {displayState === "unavailable"
                ? copy.unavailable
                : selectedDirection === "arrival"
                  ? copy.arrivalEmpty
                  : copy.departureEmpty}
            </p>
          </div>
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
  arrivalEmpty: "Trenutno nema narednih dolazaka.",
  arrivals: "Dolasci",
  cta: "Svi letovi",
  departure: "Odlazak",
  departureEmpty: "Trenutno nema narednih odlazaka.",
  departures: "Odlasci",
  stale: "Prikazani podaci mogu biti zastarjeli.",
  subtitle: "Dolasci i odlasci",
  tabsLabel: "Izaberite dolaske ili odlaske",
  title: "Aerodrom Podgorica",
  unavailable: "Podaci trenutno nijesu dostupni.",
};
const englishCopy = {
  arrival: "Arrival",
  arrivalEmpty: "There are no upcoming arrivals right now.",
  arrivals: "Arrivals",
  cta: "All flights",
  departure: "Departure",
  departureEmpty: "There are no upcoming departures right now.",
  departures: "Departures",
  stale: "Displayed data may be outdated.",
  subtitle: "Arrivals and departures",
  tabsLabel: "Choose arrivals or departures",
  title: "Podgorica Airport",
  unavailable: "Data is temporarily unavailable.",
};

export { AirportFlightsCard, type AirportFlightsCardProps };
