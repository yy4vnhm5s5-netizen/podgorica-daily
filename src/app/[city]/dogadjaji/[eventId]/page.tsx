import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { resolveActiveCityFeatureRoute } from "@/app/city-routing";
import { createPublicRouteMetadata } from "@/app/public-route-metadata";
import { getCityEvents } from "@/modules/events/application/get-city-events";
import { EventDetail } from "@/modules/events/presentation/event-detail";
import {
  createEventBreadcrumbStructuredData,
  createEventStructuredData,
  serializeStructuredData,
} from "@/modules/events/presentation/event-structured-data";
import { getPublicCityEventById } from "@/modules/events/presentation/events-ui-model";
import {
  createEventDetailMetadataDescription,
  createEventDetailMetadataTitle,
} from "@/modules/events/presentation/event-detail-metadata";
import { DashboardLayout } from "@/shared/components/layout/dashboard-layout";
import type { CityEvent } from "@/modules/events/domain/event";
import { getCityName } from "@/shared/config/cities";
import { getLocaleTag, type Locale } from "@/shared/config/locale";
import { formatDateTime } from "@/shared/lib/date";
import { getEventDetailPath } from "@/shared/config/public-routes";
import { getTranslations } from "@/shared/lib/translations";

interface EventDetailPageProps {
  params: Promise<{ city: string; eventId: string }>;
}

// Use the current collector-managed snapshot for the same public event set used
// by the dashboard and listing. This avoids a stale route-cache link resolving
// against a newer cache snapshot after a refresh.
export const revalidate = 0;

// generateMetadata and the page component below both resolve the city context and then fetch
// the full event set to look up one event by ID. Left alone, every request would do this twice —
// cache() (scoped to this file only, not the shared city-routing/get-city-events modules used
// elsewhere) makes the second call in each pair reuse the first call's result for the same
// request. The context resolver must also be cached: getCityEvents is keyed by object identity,
// and resolveActiveCityFeatureRoute otherwise returns a new context object on each call.
const getCachedEventDetailContext = cache((slug: string) =>
  resolveActiveCityFeatureRoute(slug, "events"),
);
const getCachedCityEvents = cache(getCityEvents);

// The day the event happens, in the same long Montenegrin form the page body uses. Returns
// undefined for an event whose dates do not parse, so the fallback stays as it was.
function getEventMetadataDay(event: CityEvent, locale: Locale) {
  const value = event.startsAt ?? event.startDate;
  if (!value) return undefined;
  const date = new Date(event.startsAt ? value : `${value}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return undefined;

  return formatDateTime(date, {
    formatOptions: { dateStyle: "long", timeStyle: undefined },
    locale: getLocaleTag(locale),
  }).label;
}

async function generateMetadata({ params }: EventDetailPageProps): Promise<Metadata> {
  const { city: slug, eventId } = await params;
  const locale = "me" as const;
  const context = getCachedEventDetailContext(slug);
  if (!context) return {};
  const event = getPublicCityEventById((await getCachedCityEvents(context)).events, eventId);

  if (!event) return {};

  // Uses provider facts only: the event date (never publication date or an invented time), city
  // grammar and optional venue, then a bounded plain-text source excerpt for a useful SERP snippet.
  const eventDay = getEventMetadataDay(event, locale);
  const cityLocative = getCityName(context.city, "locative");
  const description = createEventDetailMetadataDescription({ cityLocative, event, eventDay });

  return createPublicRouteMetadata({
    canonical: getEventDetailPath(context.city, event.id),
    description,
    ...(event.imageUrl ? { imageUrl: event.imageUrl } : {}),
    title: createEventDetailMetadataTitle({ city: context.city, event }),
  });
}

async function EventDetailPage({ params }: EventDetailPageProps) {
  const { city: slug, eventId } = await params;
  const locale = "me" as const;
  const context = getCachedEventDetailContext(slug);
  if (!context) notFound();
  const eventsReadModel = await getCachedCityEvents(context);
  const event = getPublicCityEventById(eventsReadModel.events, eventId);

  if (!event) notFound();
  const structuredData = createEventStructuredData(event);
  const breadcrumbStructuredData = createEventBreadcrumbStructuredData(context.city, event);

  return (
    <DashboardLayout city={context.city} translations={getTranslations(locale)}>
      {structuredData ? (
        <script
          dangerouslySetInnerHTML={{ __html: serializeStructuredData(structuredData) }}
          type="application/ld+json"
        />
      ) : null}
      <script
        dangerouslySetInnerHTML={{ __html: serializeStructuredData(breadcrumbStructuredData) }}
        type="application/ld+json"
      />
      <EventDetail city={context.city} event={event} locale={locale} />
    </DashboardLayout>
  );
}

export { generateMetadata };
export default EventDetailPage;
