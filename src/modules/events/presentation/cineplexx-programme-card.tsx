import { Clapperboard, Clock3, ExternalLink } from "lucide-react";
import Image from "next/image";

import type { CityEvent, EventProviderState } from "../domain/event.ts";
import { getCineplexxProgrammeTranslations } from "./cineplexx-programme-translations";
import {
  getCineplexxProgrammeDisplayState,
  groupCineplexxProgramme,
  type CineplexxMovieGroup,
} from "./cineplexx-programme-ui-model";
import { Card, CardContent, CardHeader } from "@/shared/components/ui/card";
import type { Locale } from "@/shared/config/locale";
import { formatDateTime } from "@/shared/lib/date";

const cineplexxProgrammeUrl = "https://www.cineplexx.me/cinemas/CINEPLEXX-PODGORICA/";

interface CineplexxProgrammeCardProps {
  day?: "today" | "tomorrow" | "none";
  events: readonly CityEvent[];
  locale: Locale;
  state: EventProviderState | undefined;
}

function CineplexxProgrammeCard({
  day = "today",
  events,
  locale,
  state,
}: CineplexxProgrammeCardProps) {
  const translations = getCineplexxProgrammeTranslations(locale);
  const movies = groupCineplexxProgramme(events).slice(0, 3);
  const displayState = getCineplexxProgrammeDisplayState({
    eventCount: movies.length,
    providerState: state,
  });

  return (
    <Card className="card-fog card-fog--neutral border-primary/15 bg-indigo-50/60 transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-[0_12px_24px_-20px_rgb(15_23_42_/_0.32)]">
      <CardHeader className="flex-row items-center gap-3 space-y-0 p-4 sm:p-5">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Clapperboard aria-hidden="true" className="size-[1.125rem]" strokeWidth={1.8} />
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-semibold tracking-tight">{translations.title}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {day === "tomorrow" ? translations.tomorrow : translations.subtitle}
          </p>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0 sm:p-5 sm:pt-0">
        {displayState === "programme" || displayState === "stale" ? (
          <ul className="divide-y divide-primary/10">
            {movies.map((movie) => (
              <CinemaMovie item={movie} key={movie.id} locale={locale} />
            ))}
          </ul>
        ) : displayState === "unavailable" ? (
          <p className="text-sm leading-6 text-muted-foreground">{translations.unavailable}</p>
        ) : (
          <p className="text-sm leading-6 text-muted-foreground">{translations.empty}</p>
        )}
        {displayState === "stale" ? (
          <p className="mt-3 text-xs leading-5 text-muted-foreground">{translations.stale}</p>
        ) : null}
        {displayState === "programme" || displayState === "stale" ? (
          <a
            className="mt-4 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            href={cineplexxProgrammeUrl}
            rel="noreferrer"
            target="_blank"
          >
            {translations.cta}
            <ExternalLink aria-hidden="true" className="size-3.5" />
          </a>
        ) : null}
      </CardContent>
    </Card>
  );
}

function CinemaMovie({ item, locale }: { item: CineplexxMovieGroup; locale: Locale }) {
  const firstScreening = item.screenings[0];
  if (!firstScreening) return null;

  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-start gap-3">
        {item.imageUrl ? (
          <Image
            alt=""
            className="size-12 shrink-0 rounded-lg object-cover"
            height={48}
            src={item.imageUrl}
            unoptimized
            width={48}
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold leading-5">
            <a
              className="rounded-md hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              href={item.movieUrl ?? firstScreening.sourceUrl}
            >
              {item.title}
            </a>
          </h3>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {item.screenings.map((screening) => (
              <li key={screening.id}>
                <a
                  className="inline-flex min-h-8 items-center gap-1 rounded-md border border-primary/15 bg-white/50 px-2 text-xs font-medium text-foreground hover:border-primary/35 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  href={screening.sourceUrl}
                >
                  <Clock3 aria-hidden="true" className="size-3" />
                  {formatScreeningTime(screening, locale)}
                  {tagValue(screening.tags, "format")
                    ? ` · ${tagValue(screening.tags, "format")}`
                    : ""}
                  {tagValue(screening.tags, "language")
                    ? ` · ${tagValue(screening.tags, "language")}`
                    : ""}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </li>
  );
}

function formatScreeningTime(item: CityEvent, locale: Locale) {
  if (!item.startsAt) return item.startDate ?? "";
  return formatDateTime(new Date(item.startsAt), {
    formatOptions: { timeStyle: "short" },
    locale: locale === "me" ? "sr-Latn-ME" : "en",
  }).label;
}

function tagValue(tags: readonly string[], name: string) {
  return tags.find((tag) => tag.startsWith(`${name}:`))?.slice(name.length + 1);
}

export { CineplexxProgrammeCard, type CineplexxProgrammeCardProps };
