import { ArrowRight, CalendarClock, MapPin } from "lucide-react";
import Link from "next/link";

import type { CityEvent } from "../domain/event.ts";
import {
  getEventPresentationCategoryLabel,
  getEventsTranslations,
  getEventStatusLabel,
} from "./events-translations";
import { getEventPresentationCategory } from "./event-presentation-category";
import { Badge } from "@/shared/components/ui/badge";
import { Card, CardContent } from "@/shared/components/ui/card";
import { getLocaleTag, type Locale } from "@/shared/config/locale";
import { getEventDetailPath } from "@/shared/config/public-routes";
import type { City } from "@/shared/types/city";
import { formatDateTime } from "@/shared/lib/date";

interface EventCardProps {
  city: City;
  event: CityEvent;
  locale: Locale;
}

function EventCard({ city, event, locale }: EventCardProps) {
  const translations = getEventsTranslations(locale);
  const statusLabel = getEventStatusLabel(locale, event.status);
  const detailHref = getEventDetailPath(city, event.id);

  return (
    <Card className="group relative overflow-hidden transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-[0_10px_22px_-18px_rgb(15_23_42_/_0.32)]">
      <Link
        aria-label={`${translations.details}: ${event.title}`}
        className="absolute inset-0 z-20 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
        href={detailHref}
      />
      <div className="pointer-events-none relative z-10 flex min-h-36">
        {event.imageUrl ? (
          <div className="w-28 shrink-0 bg-muted sm:w-36">
            {/* Provider image hosts and dimensions are not stable enough for the Next image optimizer. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt="" className="size-full object-cover" loading="lazy" src={event.imageUrl} />
          </div>
        ) : null}
        <CardContent className="flex min-w-0 flex-1 flex-col gap-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{event.sourceName}</Badge>
            <Badge variant="outline">
              {getEventPresentationCategoryLabel(
                locale,
                getEventPresentationCategory(event.category),
              )}
            </Badge>
            {statusLabel ? (
              <Badge
                className={
                  event.status === "cancelled"
                    ? "border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
                    : "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"
                }
                variant="outline"
              >
                {statusLabel}
              </Badge>
            ) : null}
          </div>
          <div className="min-w-0 space-y-1">
            <h3 className="text-base font-semibold leading-snug text-foreground transition-colors group-hover:text-brand-foreground sm:text-lg">
              {event.title}
            </h3>
            {event.venueName ? (
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin aria-hidden="true" className="size-4 shrink-0" />
                <span className="truncate">{event.venueName}</span>
              </p>
            ) : null}
          </div>
          <div className="mt-auto flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
            <CalendarClock aria-hidden="true" className="size-4 shrink-0" />
            <EventTime event={event} locale={locale} />
          </div>
          <span className="inline-flex w-fit items-center gap-1 text-sm font-medium text-brand-foreground">
            {translations.details}
            <ArrowRight
              aria-hidden="true"
              className="size-3.5 transition-transform group-hover:translate-x-0.5"
            />
          </span>
        </CardContent>
      </div>
    </Card>
  );
}

function EventTime({ event, locale }: { event: CityEvent; locale: Locale }) {
  if (event.startsAt) {
    return formatDateTime(new Date(event.startsAt), {
      formatOptions: { dateStyle: "medium", timeStyle: "short" },
      locale: getLocaleTag(locale),
    }).label;
  }

  if (event.startDate) {
    return formatDateTime(new Date(`${event.startDate}T12:00:00.000Z`), {
      formatOptions: { dateStyle: "medium", timeStyle: undefined },
      locale: getLocaleTag(locale),
    }).label;
  }

  return null;
}

export { EventCard, type EventCardProps };
