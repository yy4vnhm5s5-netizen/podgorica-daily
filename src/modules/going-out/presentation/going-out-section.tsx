import { CalendarDays, Music2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import type { GoingOutEvent } from "../domain/going-out-event";
import type { GoingOutCacheState } from "../infrastructure/montegigs-going-out";
import {
  formatGoingOutSchedule,
  getGoingOutDisplayState,
  getHomepageGoingOutEvents,
} from "./going-out-ui-model";
import { Card, CardContent, CardHeader } from "@/shared/components/ui/card";
import { InCardEmptyNote } from "@/shared/components/in-card-empty-note";
import { NewTabNotice } from "@/shared/components/new-tab-notice";
import type { Locale } from "@/shared/config/locale";
import { getGoingOutPath } from "@/shared/config/public-routes";
import type { City } from "@/shared/types/city";
import { cn } from "@/shared/lib/utils";

interface GoingOutSectionProps {
  city: City;
  events: readonly GoingOutEvent[];
  locale: Locale;
  state: GoingOutCacheState;
}

function GoingOutSection({ city, events, locale, state }: GoingOutSectionProps) {
  const copy = locale === "me" ? montenegrinCopy : englishCopy;
  const upcoming = getHomepageGoingOutEvents(events);
  const displayState = getGoingOutDisplayState({ eventCount: upcoming.length, state });

  return (
    <section aria-labelledby="going-out-heading" className="w-full" id="izlasci">
      {/* Going Out is allowed a touch more personality than the purely informational modules
          (flights, railway) — a single light violet tint, not the border+bg+card-fog stack it
          used to carry. */}
      <Card className="border-violet-100 bg-violet-50/40 shadow-[0_18px_42px_-32px_rgb(124_58_237_/_0.34)] transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-[0_20px_44px_-30px_rgb(124_58_237_/_0.38)] dark:border-violet-900/40 dark:bg-violet-950/15">
        <CardHeader className="flex-row items-center justify-between gap-4 space-y-0 p-4 sm:p-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-400 to-violet-600 text-white shadow-sm shadow-violet-900/20">
              <Music2 aria-hidden="true" className="size-[1.125rem]" strokeWidth={2} />
            </div>
            <div>
              <h2
                className="text-sm font-medium uppercase leading-5 tracking-[0.16em] text-slate-800 sm:text-[0.9375rem]"
                id="going-out-heading"
              >
                {copy.title}
              </h2>
              <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{copy.subtitle}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0 sm:p-5 sm:pt-0">
          {displayState === "events" || displayState === "stale" ? (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {upcoming.map((event, index) => (
                <GoingOutCard
                  className={getResponsiveCardVisibilityClass(index)}
                  event={event}
                  key={event.id}
                  locale={locale}
                />
              ))}
            </ul>
          ) : (
            <InCardEmptyNote icon={Music2}>
              {displayState === "unavailable" ? copy.unavailable : copy.empty}
            </InCardEmptyNote>
          )}
          <Link
            className="mt-3 inline-flex min-h-10 items-center gap-1 rounded-md text-sm font-medium text-violet-800 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 dark:text-violet-200"
            href={getGoingOutPath(city)}
          >
            {copy.all}
            <span aria-hidden="true">→</span>
          </Link>
          {displayState === "stale" ? (
            <p className="mt-3 text-xs leading-5 text-muted-foreground">{copy.stale}</p>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}

function GoingOutCard({
  className,
  event,
  locale,
}: {
  className?: string;
  event: GoingOutEvent;
  locale: Locale;
}) {
  return (
    <li className={cn("min-w-0", className)}>
      <a
        className="group flex min-h-full flex-col overflow-hidden rounded-xl border border-violet-200/60 bg-background/80 transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 dark:border-violet-800/55 dark:bg-background/70 dark:hover:border-violet-700 sm:flex-row lg:flex-col"
        href={event.sourceUrl}
        rel="noreferrer"
        target="_blank"
      >
        {event.imageUrl ? (
          <Image
            alt=""
            className="aspect-[16/9] w-full shrink-0 object-cover sm:aspect-auto sm:w-40 sm:self-stretch lg:aspect-[4/3] lg:w-full lg:self-auto"
            height={180}
            src={event.imageUrl}
            unoptimized
            width={320}
          />
        ) : (
          <div className="flex aspect-[16/9] w-full shrink-0 items-center justify-center bg-violet-100/65 text-violet-700 dark:bg-violet-900/35 dark:text-violet-300 sm:aspect-auto sm:w-40 sm:self-stretch lg:aspect-[4/3] lg:w-full lg:self-auto">
            <CalendarDays aria-hidden="true" className="size-7" strokeWidth={1.5} />
          </div>
        )}
        <div className="min-w-0 p-3.5 sm:flex sm:flex-1 sm:flex-col sm:justify-center lg:block">
          <h3 className="line-clamp-2 text-sm font-semibold leading-5 group-hover:text-violet-800 dark:group-hover:text-violet-200 sm:line-clamp-none lg:line-clamp-3">
            {event.title}
          </h3>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            {formatGoingOutSchedule(event, locale)}
          </p>
          <NewTabNotice locale={locale} />
        </div>
      </a>
    </li>
  );
}

function getResponsiveCardVisibilityClass(index: number) {
  if (index < 3) return undefined;
  if (index === 3) return "hidden sm:block";
  return "hidden lg:block";
}

// Matches the canonical /izlasci copy: the empty state describes what Gradom has, not what the
// city is doing, and the subtitle names the inventory rather than categories the listing model
// does not store. The city is omitted from the empty sentence only because the whole dashboard is
// already scoped to one city.
const montenegrinCopy = {
  all: "Pogledaj sve izlaske",
  empty: "Trenutno nemamo dostupne najave izlazaka.",
  stale: "Prikazani su posljednji dostupni podaci.",
  subtitle: "Izlasci i dešavanja",
  title: "Izlasci",
  unavailable: "Podaci trenutno nijesu dostupni.",
} as const;

const englishCopy = {
  all: "All nights out",
  empty: "We have no listings right now.",
  stale: "The latest available data is shown.",
  subtitle: "Nights out and events",
  title: "Going out",
  unavailable: "Data is currently unavailable.",
} as const;

export { GoingOutSection, type GoingOutSectionProps };
