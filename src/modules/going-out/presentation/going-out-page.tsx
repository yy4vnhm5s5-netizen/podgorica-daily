import { ExternalLink, Music2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import type { GoingOutEvent } from "../domain/going-out-event";
import { isGoingOutEventDetailEligible } from "../application/going-out-public-detail";
import type { GoingOutCacheState } from "../infrastructure/montegigs-going-out";
import {
  formatGoingOutDateHeading,
  formatGoingOutTime,
  getGoingOutDisplayState,
  getGoingOutPageEvents,
  groupGoingOutEventsByDate,
} from "./going-out-ui-model";
import { CityFeatureDiscovery } from "@/shared/components/city-feature-discovery";
import { Card, CardContent, CardHeader } from "@/shared/components/ui/card";
import { EmptyState } from "@/shared/components/empty-state";
import { NewTabNotice } from "@/shared/components/new-tab-notice";
import { SectionTitle } from "@/shared/components/section-title";
import { getCityName } from "@/shared/config/cities";
import type { Locale } from "@/shared/config/locale";
import type { City } from "@/shared/types/city";
import { getGoingOutDetailPath } from "@/shared/config/public-routes";

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
                  <GoingOutPageCard city={city} event={event} key={event.id} locale={locale} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <EmptyState
          description={
            displayState === "unavailable"
              ? copy.unavailable
              : copy.empty.replace("{city}", cityName)
          }
          title={copy.title.replace("{city}", cityName)}
        />
      )}
      {displayState === "stale" ? (
        <p className="text-xs text-muted-foreground">{copy.stale}</p>
      ) : null}

      <CityFeatureDiscovery city={city} currentFeature="goingOut" />
    </section>
  );
}

function GoingOutPageCard({
  city,
  event,
  locale,
}: {
  city: City;
  event: GoingOutEvent;
  locale: Locale;
}) {
  const copy = locale === "me" ? montenegrinCopy : englishCopy;
  const time = formatGoingOutTime(event, locale);
  const detailEligible = isGoingOutEventDetailEligible(event, city);
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
          {/* The day heading above already states the date, so the card carries only the time and
              the venue. Either may be absent; nothing is substituted for a missing one. */}
          {time || event.venue ? (
            <p className="text-sm leading-6 text-muted-foreground">
              {[time, event.venue].filter(Boolean).join(" · ")}
            </p>
          ) : null}
        </CardHeader>
        <CardContent className="p-4 pt-0 sm:p-5 sm:pt-0">
          {detailEligible ? (
            <Link
              className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-violet-800 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 dark:text-violet-200"
              href={getGoingOutDetailPath(city, "montegigs", event.sourceEventId)}
            >
              {copy.details}
            </Link>
          ) : (
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
          )}
        </CardContent>
      </Card>
    </li>
  );
}

// The listing stays deliberately concise even though the normal snapshot now also carries richer
// source fields for eligible detail pages. It never claims to cover everything happening in a city.
const montenegrinCopy = {
  details: "Detalji",
  description:
    "Pregled predstojećih izlazaka i dešavanja u {city}, grupisan po danima, sa vremenom početka i mjestom kada su poznati.",
  empty: "Trenutno nemamo dostupne najave izlazaka u {city}.",
  source: "Pogledajte na MonteGigs-u",
  stale: "Prikazani su posljednji dostupni podaci.",
  title: "Izlasci u {city}",
  unavailable: "Podaci trenutno nijesu dostupni.",
} as const;

const englishCopy = {
  details: "Details",
  description:
    "Upcoming nights out and events in {city}, grouped by day, with start time and venue where known.",
  empty: "We have no listings for {city} right now.",
  source: "View on MonteGigs",
  stale: "The latest available data is shown.",
  title: "Nights out in {city}",
  unavailable: "Data is currently unavailable.",
} as const;

export { GoingOutPage, type GoingOutPageProps };
