import { CalendarClock, MapPin } from "lucide-react";
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
import { formatDateTime } from "@/shared/lib/date";

interface EventCardProps {
  event: CityEvent;
  locale: Locale;
}

function EventCard({ event, locale }: EventCardProps) {
  const translations = getEventsTranslations(locale);
  const statusLabel = getEventStatusLabel(locale, event.status);
  const detailHref = `/${locale}/events/${encodeURIComponent(event.id)}`;

  return (
    <Card className="overflow-hidden transition-colors hover:border-primary/40">
      <div className="flex min-h-36">
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
            <h3 className="text-base font-semibold leading-snug sm:text-lg">
              <Link
                className="rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                href={detailHref}
              >
                {event.title}
              </Link>
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
          <Link
            aria-label={`${translations.details}: ${event.title}`}
            className="w-fit rounded-sm text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            href={detailHref}
          >
            {translations.details}
          </Link>
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
