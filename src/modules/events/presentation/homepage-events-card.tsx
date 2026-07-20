import { CalendarDays, Clock3 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import type { CityEvent } from "../domain/event.ts";
import { getEventsTranslations } from "./events-translations";
import { getHomepageVenueName } from "./events-ui-model";
import { Card, CardContent, CardHeader } from "@/shared/components/ui/card";
import { getLocaleTag, type Locale } from "@/shared/config/locale";
import { formatDateTime } from "@/shared/lib/date";

interface HomepageEventsCardProps {
  eventCount: number;
  events: readonly CityEvent[];
  isUnavailable: boolean;
  locale: Locale;
}

function HomepageEventsCard({
  eventCount,
  events,
  isUnavailable,
  locale,
}: HomepageEventsCardProps) {
  const translations = getEventsTranslations(locale);

  return (
    <Card className="card-fog card-fog--warning border-primary/15 bg-amber-50/60 transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-[0_12px_24px_-20px_rgb(15_23_42_/_0.32)]">
      <CardHeader className="flex-row items-center gap-3 space-y-0 p-4 sm:p-5">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <CalendarDays aria-hidden="true" className="size-[1.125rem]" strokeWidth={1.8} />
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-semibold tracking-tight">{translations.heading}</h2>
          <p className="mt-0.5 text-xs leading-4 text-muted-foreground sm:text-sm">
            {translations.homepageSupportingText} <span aria-hidden="true">•</span>{" "}
            {translations.eventsCount(eventCount)}
          </p>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0 sm:p-5 sm:pt-0">
        {events.length > 0 ? (
          <ul className="divide-y divide-primary/10">
            {events.map((event) => (
              <HomepageEvent event={event} key={event.id} locale={locale} />
            ))}
          </ul>
        ) : isUnavailable ? (
          <p className="text-sm leading-6 text-muted-foreground">
            {translations.homepageUnavailable}
          </p>
        ) : (
          <p className="text-sm leading-6 text-muted-foreground">{translations.homepageEmpty}</p>
        )}
        <Link
          className="mt-4 inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          href={`/${locale}/events`}
        >
          {translations.viewAllEvents}
        </Link>
      </CardContent>
    </Card>
  );
}

function HomepageEvent({ event, locale }: { event: CityEvent; locale: Locale }) {
  const venueName = getHomepageVenueName(event.venueName);

  return (
    <li className="py-2.5 first:pt-0 last:pb-0">
      <Link
        className="group flex items-start gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        href={`/${locale}/events/${encodeURIComponent(event.id)}`}
      >
        {event.imageUrl ? (
          <Image
            alt=""
            className="size-12 shrink-0 rounded-lg object-cover"
            height={48}
            src={event.imageUrl}
            unoptimized
            width={48}
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold leading-5 group-hover:text-primary">
            {event.title}
          </h3>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">
            <EventSchedule event={event} locale={locale} />
          </p>
          {venueName ? (
            <p className="truncate text-xs leading-5 text-muted-foreground">{venueName}</p>
          ) : null}
        </div>
      </Link>
    </li>
  );
}

function EventSchedule({ event, locale }: { event: CityEvent; locale: Locale }) {
  if (event.startsAt) {
    return (
      <span className="inline-flex items-center gap-1">
        <Clock3 aria-hidden="true" className="size-3.5" />
        {
          formatDateTime(new Date(event.startsAt), {
            formatOptions: { dateStyle: "medium", timeStyle: "short" },
            locale: getLocaleTag(locale),
          }).label
        }
      </span>
    );
  }

  if (event.startDate) {
    return formatDateTime(new Date(`${event.startDate}T12:00:00.000Z`), {
      formatOptions: { dateStyle: "medium", timeStyle: undefined },
      locale: getLocaleTag(locale),
    }).label;
  }

  return null;
}

export { HomepageEventsCard, type HomepageEventsCardProps };
