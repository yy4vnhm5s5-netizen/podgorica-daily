import { ExternalLink, TrainFront } from "lucide-react";

import {
  selectUpcomingRailwayDepartures,
  type RailwayDeparture,
} from "../domain/railway-departure";
import {
  getRailwayStationDisplayState,
  type RailwayCacheState,
} from "./railway-station-ui-model";
import { Card, CardContent, CardHeader } from "@/shared/components/ui/card";
import type { Locale } from "@/shared/config/locale";

const timetableUrl = "https://zpcg.me/red-voznje/ukupno";
const homepageDepartureLimit = 3;

interface RailwayStationCardProps {
  departures: readonly RailwayDeparture[];
  locale: Locale;
  state: RailwayCacheState;
}

function RailwayStationCard({ departures, locale, state }: RailwayStationCardProps) {
  const copy = locale === "me" ? montenegrinCopy : englishCopy;
  const upcoming = selectUpcomingRailwayDepartures(
    departures,
    new Date(),
    homepageDepartureLimit,
  );
  const displayState = getRailwayStationDisplayState({
    departureCount: upcoming.length,
    state,
  });

  return (
    <Card className="card-fog card-fog--neutral border-primary/15 bg-slate-50/65 transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-[0_12px_24px_-20px_rgb(15_23_42_/_0.32)]">
      <CardHeader className="flex-row items-center gap-3 space-y-0 p-4 sm:p-5">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <TrainFront aria-hidden="true" className="size-[1.125rem]" strokeWidth={1.8} />
        </div>
        <div>
          <h2 className="text-base font-semibold tracking-tight">{copy.title}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{copy.subtitle}</p>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0 sm:p-5 sm:pt-0">
        {displayState === "departures" || displayState === "stale" ? (
          <ul className="divide-y divide-primary/10">
            {upcoming.map((departure) => (
              <RailwayDepartureRow
                departure={departure}
                key={departureKey(departure)}
                locale={locale}
              />
            ))}
          </ul>
        ) : (
          <p className="text-sm leading-6 text-muted-foreground">
            {displayState === "unavailable" ? copy.unavailable : copy.empty}
          </p>
        )}
        {state === "stale" ? <p className="mt-3 text-xs leading-5 text-muted-foreground">{copy.stale}</p> : null}
        <a
          className="mt-4 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          href={timetableUrl}
          rel="noreferrer"
          target="_blank"
        >
          {copy.cta}
          <ExternalLink aria-hidden="true" className="size-3.5" />
        </a>
      </CardContent>
    </Card>
  );
}

function RailwayDepartureRow({ departure, locale }: { departure: RailwayDeparture; locale: Locale }) {
  return (
    <li className="py-2.5 first:pt-0 last:pb-0">
      <p className="break-words text-sm font-semibold">{departure.destination}</p>
      <p className="mt-0.5 text-sm text-muted-foreground">
        {departure.departureTime}
        {departure.arrivalTime ? ` → ${departure.arrivalTime}` : ""}
      </p>
      {departure.trainNumber ? (
        <p className="text-xs leading-5 text-muted-foreground">
          {locale === "me" ? "Voz" : "Train"} {departure.trainNumber}
        </p>
      ) : null}
    </li>
  );
}

function departureKey(departure: RailwayDeparture) {
  return `${departure.departureDate}-${departure.departureTime}-${departure.destination}-${departure.trainNumber ?? ""}`;
}

const montenegrinCopy = {
  cta: "Pogledajte kompletan red vožnje",
  empty: "Trenutno nema narednih polazaka.",
  stale: "Prikazani podaci mogu biti zastarjeli.",
  subtitle: "Polasci iz Podgorice",
  title: "Željeznička stanica",
  unavailable: "Podaci trenutno nijesu dostupni.",
};
const englishCopy = {
  cta: "View the full timetable",
  empty: "There are no upcoming departures.",
  stale: "Displayed data may be outdated.",
  subtitle: "Departures from Podgorica",
  title: "Railway station",
  unavailable: "Data is temporarily unavailable.",
};

export { RailwayStationCard, type RailwayStationCardProps };
