import { ArrowLeft, CalendarClock, ExternalLink, MapPin, Users } from "lucide-react";
import Link from "next/link";

import type { CityEvent } from "../domain/event.ts";
import {
  getEventCategoryLabel,
  getEventsTranslations,
  getEventStatusLabel,
} from "./events-translations";
import { Badge } from "@/shared/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/shared/components/ui/card";
import { getLocaleTag, type Locale } from "@/shared/config/locale";
import { formatDateTime } from "@/shared/lib/date";

interface EventDetailProps {
  event: CityEvent;
  locale: Locale;
}

function EventDetail({ event, locale }: EventDetailProps) {
  const translations = getEventsTranslations(locale);
  const statusLabel = getEventStatusLabel(locale, event.status);

  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <Link
        className="inline-flex min-h-11 items-center gap-2 rounded-md px-1 text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        href={`/${locale}/events`}
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {translations.backToEvents}
      </Link>
      <Card className="overflow-hidden">
        {event.imageUrl ? (
          <div className="aspect-[16/8] bg-muted">
            {/* Provider image hosts and dimensions are not stable enough for the Next image optimizer. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt="" className="size-full object-cover" src={event.imageUrl} />
          </div>
        ) : null}
        <CardHeader className="gap-4 p-5 sm:p-8">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{event.sourceName}</Badge>
            <Badge variant="outline">{getEventCategoryLabel(locale, event.category)}</Badge>
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
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{event.title}</h1>
          {statusLabel ? (
            <p className="text-sm font-medium text-muted-foreground">{statusLabel}</p>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-6 p-5 pt-0 sm:p-8 sm:pt-0">
          <dl className="grid gap-4 border-y py-5 text-sm sm:grid-cols-2">
            <EventDetailItem
              icon={CalendarClock}
              label={translations.dateAndTime}
              value={formatEventSchedule(event, locale)}
            />
            {event.venueName || event.address ? (
              <EventDetailItem
                icon={MapPin}
                label={translations.location}
                value={event.venueName ?? event.address}
              />
            ) : null}
            {event.organizer ? (
              <EventDetailItem
                icon={Users}
                label={translations.organizer}
                value={event.organizer}
              />
            ) : null}
          </dl>
          {event.description ? (
            <p className="whitespace-pre-line leading-7 text-muted-foreground">
              {event.description}
            </p>
          ) : null}
          <a
            className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border px-4 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            href={event.sourceUrl}
            rel="noreferrer"
            target="_blank"
          >
            {translations.officialSource}
            <ExternalLink aria-hidden="true" className="size-4" />
          </a>
        </CardContent>
      </Card>
    </article>
  );
}

function EventDetailItem({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CalendarClock;
  label: string;
  value?: string;
}) {
  if (!value) return null;

  return (
    <div className="flex gap-3">
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div>
        <dt className="text-muted-foreground">{label}</dt>
        <dd className="mt-0.5 font-medium">{value}</dd>
      </div>
    </div>
  );
}

function formatEventSchedule(event: CityEvent, locale: Locale) {
  if (event.startsAt) {
    const startsAt = formatDateTime(new Date(event.startsAt), {
      locale: getLocaleTag(locale),
    }).label;
    if (!event.endsAt) return startsAt;
    const endsAt = formatDateTime(new Date(event.endsAt), {
      formatOptions: { hour: "2-digit", minute: "2-digit" },
      locale: getLocaleTag(locale),
    }).label;
    return `${startsAt} – ${endsAt}`;
  }

  return event.startDate
    ? formatDateTime(new Date(`${event.startDate}T12:00:00.000Z`), {
        formatOptions: { dateStyle: "medium", timeStyle: undefined },
        locale: getLocaleTag(locale),
      }).label
    : undefined;
}

export { EventDetail, type EventDetailProps };
