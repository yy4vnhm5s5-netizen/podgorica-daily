import { CalendarDays, Clock3, MapPin } from "lucide-react";
import Link from "next/link";

import type { CityEvent } from "../domain/event.ts";
import { getEventPresentationCategory } from "./event-presentation-category";
import {
  getEventPresentationCategoryLabel,
  getEventsTranslations,
} from "./events-translations";
import { Badge } from "@/shared/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/shared/components/ui/card";
import { getLocaleTag, type Locale } from "@/shared/config/locale";
import { formatDateTime } from "@/shared/lib/date";

interface HomepageEventsCardProps {
  events: readonly CityEvent[];
  isUnavailable: boolean;
  locale: Locale;
}

function HomepageEventsCard({ events, isUnavailable, locale }: HomepageEventsCardProps) {
  const translations = getEventsTranslations(locale);

  return (
    <Card className="card-fog card-fog--warning border-amber-200/80 bg-amber-50/60 transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-[0_12px_24px_-20px_rgb(15_23_42_/_0.32)]">
      <CardHeader className="flex-row items-center gap-3 space-y-0 p-4 sm:p-5">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-100/80 text-amber-800">
          <CalendarDays aria-hidden="true" className="size-[1.125rem]" strokeWidth={1.8} />
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-semibold tracking-tight">{translations.heading}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{translations.homepageSupportingText}</p>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0 sm:p-5 sm:pt-0">
        {events.length > 0 ? (
          <ul className="divide-y divide-amber-200/70">
            {events.map((event) => (
              <li className="py-3 first:pt-0 last:pb-0" key={event.id}>
                <Link
                  className="group block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  href={`/${locale}/events/${encodeURIComponent(event.id)}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="min-w-0 text-sm font-semibold leading-5 group-hover:text-primary">
                      {event.title}
                    </h3>
                    <Badge className="shrink-0" variant="outline">
                      {getEventPresentationCategoryLabel(
                        locale,
                        getEventPresentationCategory(event.category),
                      )}
                    </Badge>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
                    <EventSchedule event={event} locale={locale} />
                    {event.venueName ? (
                      <span className="inline-flex items-center gap-1">
                        <MapPin aria-hidden="true" className="size-3.5" />
                        {event.venueName}
                      </span>
                    ) : null}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : isUnavailable ? (
          <p className="text-sm leading-6 text-muted-foreground">{translations.homepageUnavailable}</p>
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

function EventSchedule({ event, locale }: { event: CityEvent; locale: Locale }) {
  if (event.startsAt) {
    return (
      <span className="inline-flex items-center gap-1">
        <Clock3 aria-hidden="true" className="size-3.5" />
        {formatDateTime(new Date(event.startsAt), {
          formatOptions: { dateStyle: "medium", timeStyle: "short" },
          locale: getLocaleTag(locale),
        }).label}
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
