import { ExternalLink, Music2 } from "lucide-react";
import Image from "next/image";

import type { GoingOutEvent } from "../domain/going-out-event";
import type { GoingOutCacheState } from "../infrastructure/montegigs-going-out";
import {
  formatGoingOutSchedule,
  getGoingOutDisplayState,
  getGoingOutPageEvents,
} from "./going-out-ui-model";
import { Card, CardContent, CardHeader } from "@/shared/components/ui/card";
import { SectionTitle } from "@/shared/components/section-title";
import type { Locale } from "@/shared/config/locale";

interface GoingOutPageProps {
  events: readonly GoingOutEvent[];
  locale: Locale;
  state: GoingOutCacheState;
}

function GoingOutPage({ events, locale, state }: GoingOutPageProps) {
  const copy = locale === "me" ? montenegrinCopy : englishCopy;
  const upcoming = getGoingOutPageEvents(events);
  const displayState = getGoingOutDisplayState({ eventCount: upcoming.length, state });

  return (
    <section aria-labelledby="going-out-page-heading" className="space-y-6" id="izlasci">
      <div className="space-y-2">
        <SectionTitle id="going-out-page-heading" title={copy.title} />
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{copy.description}</p>
      </div>
      {displayState === "events" || displayState === "stale" ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {upcoming.map((event) => (
            <GoingOutPageCard event={event} key={event.id} locale={locale} />
          ))}
        </ul>
      ) : (
        <Card className="border-violet-200/65 bg-violet-50/45 dark:border-violet-800/55 dark:bg-violet-950/25">
          <CardContent className="p-5 text-sm leading-6 text-muted-foreground">
            {displayState === "unavailable" ? copy.unavailable : copy.empty}
          </CardContent>
        </Card>
      )}
      {displayState === "stale" ? (
        <p className="text-xs text-muted-foreground">{copy.stale}</p>
      ) : null}
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
          <h2 className="text-base font-semibold leading-6">{event.title}</h2>
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
            <ExternalLink aria-hidden="true" className="size-3.5" />
          </a>
        </CardContent>
      </Card>
    </li>
  );
}

const montenegrinCopy = {
  description:
    "Pronađite koncerte, DJ večeri, svirke, žurke i druge izlaske u Podgorici na jednom mjestu.",
  empty: "Trenutno nema najavljenih izlazaka.",
  source: "Pogledajte na MonteGigs-u",
  stale: "Prikazani su posljednji dostupni podaci.",
  title: "Izlasci u Podgorici – koncerti, žurke i noćni život",
  unavailable: "Podaci trenutno nijesu dostupni.",
} as const;

const englishCopy = {
  description: "Upcoming music performances, parties and other nights out in Podgorica.",
  empty: "There are no upcoming nights out right now.",
  source: "View on MonteGigs",
  stale: "The latest available data is shown.",
  title: "Nights out in Podgorica",
  unavailable: "Data is currently unavailable.",
} as const;

export { GoingOutPage, type GoingOutPageProps };
