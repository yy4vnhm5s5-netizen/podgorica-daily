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
import type { Locale } from "@/shared/config/locale";
import { getGoingOutPath } from "@/shared/config/public-routes";
import { cn } from "@/shared/lib/utils";

interface GoingOutSectionProps {
  events: readonly GoingOutEvent[];
  locale: Locale;
  state: GoingOutCacheState;
}

function GoingOutSection({ events, locale, state }: GoingOutSectionProps) {
  const copy = locale === "me" ? montenegrinCopy : englishCopy;
  const upcoming = getHomepageGoingOutEvents(events);
  const displayState = getGoingOutDisplayState({ eventCount: upcoming.length, state });

  return (
    <section aria-labelledby="going-out-heading" className="w-full" id="izlasci">
      <Card className="card-fog border-violet-200/65 bg-violet-50/50 shadow-sm shadow-violet-950/[0.025] transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-violet-300/80 hover:shadow-[0_12px_24px_-20px_rgb(76_29_149_/_0.24)] dark:border-violet-800/55 dark:bg-violet-950/25 dark:hover:border-violet-700/70">
        <CardHeader className="flex-row items-center justify-between gap-4 space-y-0 p-4 sm:p-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-violet-600/10 text-violet-700 dark:text-violet-300">
              <Music2 aria-hidden="true" className="size-[1.125rem]" strokeWidth={1.8} />
            </div>
            <div>
              <h2 className="text-base font-semibold tracking-tight" id="going-out-heading">
                {copy.title}
              </h2>
              <p className="mt-0.5 text-sm text-muted-foreground">{copy.subtitle}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0 sm:p-5 sm:pt-0">
          {displayState === "events" || displayState === "stale" ? (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
            <p className="text-sm leading-6 text-muted-foreground">
              {displayState === "unavailable" ? copy.unavailable : copy.empty}
            </p>
          )}
          <Link
            className="mt-3 inline-flex min-h-10 items-center gap-1 rounded-md text-sm font-medium text-violet-800 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 dark:text-violet-200"
            href={getGoingOutPath()}
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
        className="group flex min-h-full flex-col overflow-hidden rounded-xl border border-violet-200/60 bg-background/80 transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 dark:border-violet-800/55 dark:bg-background/70 dark:hover:border-violet-700"
        href={event.sourceUrl}
        rel="noreferrer"
        target="_blank"
      >
        {event.imageUrl ? (
          <Image
            alt=""
            className="aspect-[16/9] w-full object-cover"
            height={180}
            src={event.imageUrl}
            unoptimized
            width={320}
          />
        ) : (
          <div className="flex aspect-[16/9] items-center justify-center bg-violet-100/65 text-violet-700 dark:bg-violet-900/35 dark:text-violet-300">
            <CalendarDays aria-hidden="true" className="size-7" strokeWidth={1.5} />
          </div>
        )}
        <div className="min-w-0 p-3.5">
          <h3 className="line-clamp-2 text-sm font-semibold leading-5 group-hover:text-violet-800 dark:group-hover:text-violet-200">
            {event.title}
          </h3>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            {formatGoingOutSchedule(event, locale)}
          </p>
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

const montenegrinCopy = {
  all: "Pogledaj sve izlaske",
  empty: "Trenutno nema najavljenih izlazaka.",
  stale: "Prikazani su posljednji dostupni podaci.",
  subtitle: "Muzika, nastupi i noćni život",
  title: "Izlasci",
  unavailable: "Podaci trenutno nijesu dostupni.",
} as const;

const englishCopy = {
  all: "All nights out",
  empty: "There are no upcoming nights out right now.",
  stale: "The latest available data is shown.",
  subtitle: "Music, performances and nightlife",
  title: "Nights out",
  unavailable: "Data is currently unavailable.",
} as const;

export { GoingOutSection, type GoingOutSectionProps };
