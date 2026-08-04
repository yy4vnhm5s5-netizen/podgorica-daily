import { ExternalLink, Music2 } from "lucide-react";
import Image from "next/image";

import type { GoingOutEvent } from "../domain/going-out-event";
import type { GoingOutCacheState } from "../infrastructure/montegigs-going-out";
import {
  formatGoingOutDateHeading,
  formatGoingOutSchedule,
  getGoingOutDisplayState,
  getGoingOutPageEvents,
  groupGoingOutEventsByDate,
} from "./going-out-ui-model";
import { Card, CardContent, CardHeader } from "@/shared/components/ui/card";
import { EmptyState } from "@/shared/components/empty-state";
import { ExploreCityLinks } from "@/shared/components/explore-city-links";
import { NewTabNotice } from "@/shared/components/new-tab-notice";
import { SectionTitle } from "@/shared/components/section-title";
import { getCityName } from "@/shared/config/cities";
import type { Locale } from "@/shared/config/locale";
import type { City } from "@/shared/types/city";

interface GoingOutPageProps {
  city: City;
  events: readonly GoingOutEvent[];
  locale: Locale;
  state: GoingOutCacheState;
}

function GoingOutPage({ city, events, locale, state }: GoingOutPageProps) {
  const copy = locale === "me" ? montenegrinCopy : englishCopy;
  const cityName = getCityName(city, locale === "me" ? "locative" : "nominative");
  const upcoming = getGoingOutPageEvents(events);
  const displayState = getGoingOutDisplayState({ eventCount: upcoming.length, state });
  const dateGroups = groupGoingOutEventsByDate(upcoming);

  return (
    <section aria-labelledby="going-out-page-heading" className="space-y-6" id="izlasci">
      <div className="space-y-2">
        <SectionTitle
          as="h1"
          icon={Music2}
          iconClassName="bg-gradient-to-br from-violet-400 to-violet-600 text-white shadow-violet-900/20"
          id="going-out-page-heading"
          title={copy.title.replace("{city}", cityName)}
        />
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          {copy.description.replace("{city}", cityName)}
        </p>
      </div>
      {displayState === "events" || displayState === "stale" ? (
        // Grouped by the day each listing falls on, mirroring the Događaji and Struja listings.
        <div className="space-y-8">
          {dateGroups.map((group) => (
            <section aria-labelledby={`izlasci-${group.date}`} key={group.date}>
              <h2
                className="text-sm font-semibold uppercase tracking-wide text-muted-foreground"
                id={`izlasci-${group.date}`}
              >
                {formatGoingOutDateHeading(group.date, locale)}
              </h2>
              <ul className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {group.events.map((event) => (
                  <GoingOutPageCard event={event} key={event.id} locale={locale} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <EmptyState
          description={displayState === "unavailable" ? copy.unavailable : copy.empty}
          title={copy.title.replace("{city}", cityName)}
        />
      )}
      {displayState === "stale" ? (
        <p className="text-xs text-muted-foreground">{copy.stale}</p>
      ) : null}

      <ExploreCityLinks city={city} exclude={["goingOut"]} />
    </section>
  );
}

function GoingOutPageCard({ event, locale }: { event: GoingOutEvent; locale: Locale }) {
  const copy = locale === "me" ? montenegrinCopy : englishCopy;
  return (
    <li className="min-w-0">
      <Card className="h-full overflow-hidden border-violet-200/65 bg-violet-50/45 shadow-sm shadow-violet-950/[0.025] dark:border-violet-800/55 dark:bg-violet-950/25">
        {event.imageUrl ? (
          <Image
            alt=""
            className="aspect-[16/9] w-full object-cover"
            height={260}
            src={event.imageUrl}
            unoptimized
            width={460}
          />
        ) : (
          <div className="flex aspect-[16/9] items-center justify-center bg-violet-100/65 text-violet-700 dark:bg-violet-900/35 dark:text-violet-300">
            <Music2 aria-hidden="true" className="size-8" strokeWidth={1.5} />
          </div>
        )}
        <CardHeader className="p-4 sm:p-5">
          <h3 className="text-base font-semibold leading-6">{event.title}</h3>
          <p className="text-sm leading-6 text-muted-foreground">
            {formatGoingOutSchedule(event, locale)}
          </p>
          {event.venue ? <p className="text-sm text-muted-foreground">{event.venue}</p> : null}
        </CardHeader>
        <CardContent className="p-4 pt-0 sm:p-5 sm:pt-0">
          <a
            className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-violet-800 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 dark:text-violet-200"
            href={event.sourceUrl}
            rel="noreferrer"
            target="_blank"
          >
            {copy.source}
            <NewTabNotice locale={locale} />
            <ExternalLink aria-hidden="true" className="size-3.5" />
          </a>
        </CardContent>
      </Card>
    </li>
  );
}

const montenegrinCopy = {
  description:
    "Pronađite koncerte, DJ večeri, svirke, žurke i druge izlaske u {city} na jednom mjestu.",
  empty: "Trenutno nema najavljenih izlazaka.",
  source: "Pogledajte na MonteGigs-u",
  stale: "Prikazani su posljednji dostupni podaci.",
  title: "Izlasci u {city} – koncerti, žurke i noćni život",
  unavailable: "Podaci trenutno nijesu dostupni.",
} as const;

const englishCopy = {
  description: "Upcoming music performances, parties and other nights out in {city}.",
  empty: "There are no upcoming nights out right now.",
  source: "View on MonteGigs",
  stale: "The latest available data is shown.",
  title: "Nights out in {city}",
  unavailable: "Data is currently unavailable.",
} as const;

export { GoingOutPage, type GoingOutPageProps };
