import { Clapperboard, Clock3, ExternalLink } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import type { CityEvent, EventProviderState } from "../domain/event.ts";
import { getCineplexxProgrammeTranslations } from "./cineplexx-programme-translations";
import {
  getCineplexxProgrammeDisplayState,
  groupCineplexxProgramme,
  type CineplexxMovieGroup,
} from "./cineplexx-programme-ui-model";
import { Card, CardContent, CardHeader } from "@/shared/components/ui/card";
import { InCardEmptyNote } from "@/shared/components/in-card-empty-note";
import { NewTabNotice } from "@/shared/components/new-tab-notice";
import type { Locale } from "@/shared/config/locale";
import { formatDateTime } from "@/shared/lib/date";

const cineplexxProgrammeUrl = "https://www.cineplexx.me/cinemas/CINEPLEXX-PODGORICA/";

interface CineplexxProgrammeCardProps {
  day?: "today" | "tomorrow" | "none";
  events: readonly CityEvent[];
  /** Maximum number of distinct movies to display. Omit to show every movie in `events`. */
  limit?: number;
  locale: Locale;
  state: EventProviderState | undefined;
  /**
   * Internal href for the city's full cinema listing. Passed by the city dashboard so the compact
   * teaser links onward to /[city]/filmovi; omitted by the /filmovi page itself, which would
   * otherwise render a link to the page you are already on.
   *
   * Presence of this prop is what distinguishes the two surfaces, so it also decides the footer
   * CTA: a teaser sends the reader to our own listing, and only the listing itself offers the
   * external Cineplexx programme. That keeps the dashboard from competing with itself by
   * dangling an off-site exit next to the internal one.
   */
  viewAllHref?: string;
}

function CineplexxProgrammeCard({
  day = "today",
  events,
  limit,
  locale,
  state,
  viewAllHref,
}: CineplexxProgrammeCardProps) {
  const translations = getCineplexxProgrammeTranslations(locale);
  // `.slice(0, undefined)` returns the full array, so an omitted `limit` shows every movie.
  const movies = groupCineplexxProgramme(events).slice(0, limit);
  const displayState = getCineplexxProgrammeDisplayState({
    eventCount: movies.length,
    providerState: state,
  });

  return (
    <Card className="border-border bg-background shadow-[0_18px_42px_-32px_rgb(37_99_235_/_0.28)] transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-[0_20px_44px_-30px_rgb(37_99_235_/_0.32)]">
      <CardHeader className="flex-row items-center gap-3 space-y-0 p-4 sm:p-5">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 text-white shadow-sm shadow-blue-900/20">
          <Clapperboard aria-hidden="true" className="size-[1.125rem]" strokeWidth={2} />
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
          <InCardEmptyNote icon={Clapperboard}>{translations.unavailable}</InCardEmptyNote>
        ) : (
          <InCardEmptyNote icon={Clapperboard}>{translations.empty}</InCardEmptyNote>
        )}
        {displayState === "stale" ? (
          <p className="mt-3 text-xs leading-5 text-muted-foreground">{translations.stale}</p>
        ) : null}
        {/* Exactly one footer CTA, chosen by surface. The teaser (dashboard) always offers the
            internal listing — unconditionally, like HomepageEventsCard, so /[city]/filmovi stays
            reachable and crawlable even on a day with no screenings or an unavailable provider.
            The listing page itself has nowhere further to send the reader internally, so there
            and only there the external Cineplexx programme is offered instead. */}
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1">
          {viewAllHref ? (
            <Link
              className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-brand-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              href={viewAllHref}
            >
              {translations.viewAll}
              <span aria-hidden="true">→</span>
            </Link>
          ) : null}
          {!viewAllHref && (displayState === "programme" || displayState === "stale") ? (
            <a
              className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-brand-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              href={cineplexxProgrammeUrl}
              rel="noreferrer"
              target="_blank"
            >
              {translations.cta}
              <NewTabNotice locale={locale} />
              <ExternalLink aria-hidden="true" className="size-3.5" />
            </a>
          ) : null}
        </div>
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
