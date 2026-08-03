import { ArrowLeft, CalendarClock, ExternalLink, MapPin, Users } from "lucide-react";
import Link from "next/link";

import type { CityEvent } from "../domain/event.ts";
import { getEventPresentationCategoryLabel, getEventsTranslations } from "./events-translations";
import { getEventDetailStatusNotice } from "./events-ui-model.ts";
import { getEventPresentationCategory } from "./event-presentation-category";
import { formatEventSchedule } from "./event-schedule.ts";
import { getEventSummary } from "./event-summary";
import { Badge } from "@/shared/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/shared/components/ui/card";
import { NewTabNotice } from "@/shared/components/new-tab-notice";
import type { Locale } from "@/shared/config/locale";
import { getEventsPath } from "@/shared/config/public-routes";
import type { City } from "@/shared/types/city";

interface EventDetailProps {
  city: City;
  event: CityEvent;
  locale: Locale;
  now?: Date;
}

function EventDetail({ city, event, locale, now = new Date() }: EventDetailProps) {
  const translations = getEventsTranslations(locale);
  // Derived per render from the event's dates, so a page that was upcoming yesterday says the
  // event has ended today without any refresh having to rewrite the snapshot.
  const statusNotice = getEventDetailStatusNotice(event, locale, { now, timezone: city.timezone });
  const summary = getEventSummary(event.description);

  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <Link
        className="inline-flex min-h-11 items-center gap-2 rounded-md px-1 text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        href={getEventsPath(city)}
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
            <Badge variant="outline">
              {getEventPresentationCategoryLabel(
                locale,
                getEventPresentationCategory(event.category),
              )}
            </Badge>
            {statusNotice ? (
              <Badge className={statusBadgeStyles[statusNotice.tone]} variant="outline">
                {statusNotice.label}
              </Badge>
            ) : null}
          </div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{event.title}</h1>
          {statusNotice ? (
            <p className="text-sm font-medium text-muted-foreground">{statusNotice.label}</p>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-6 p-5 pt-0 sm:p-8 sm:pt-0">
          <dl className="grid gap-4 border-y py-5 text-sm sm:grid-cols-2">
            <EventDetailItem
              icon={CalendarClock}
              label={translations.dateAndTime}
              value={formatEventSchedule(event, locale)}
            />
            {event.venueName ? (
              <EventDetailItem
                icon={MapPin}
                label={translations.location}
                value={event.venueName}
              />
            ) : null}
            {event.address ? (
              <EventDetailItem icon={MapPin} label={translations.address} value={event.address} />
            ) : null}
            {event.organizer ? (
              <EventDetailItem
                icon={Users}
                label={translations.organizer}
                value={event.organizer}
              />
            ) : null}
          </dl>
          {summary ? <p className="leading-7 text-muted-foreground">{summary}</p> : null}
          <a
            className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border px-4 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            href={event.sourceUrl}
            rel="noreferrer"
            target="_blank"
          >
            {translations.officialSource}
            <NewTabNotice locale={locale} />
            <ExternalLink aria-hidden="true" className="size-4" />
          </a>
        </CardContent>
      </Card>
    </article>
  );
}

// A finished event is a neutral fact, not a problem, so it stays visually quiet — unlike the
// cancelled/postponed tones, which warn the reader about a change to the programme.
const statusBadgeStyles = {
  cancelled:
    "border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200",
  ended: "text-muted-foreground",
  postponed:
    "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100",
} as const;

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

export { EventDetail, type EventDetailProps };
