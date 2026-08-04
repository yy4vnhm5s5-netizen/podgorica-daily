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
import {
  getEventDetailPageTitle,
  getPublicCityEventById,
} from "@/modules/events/presentation/events-ui-model";
import { DashboardLayout } from "@/shared/components/layout/dashboard-layout";
import { getCityName } from "@/shared/config/cities";
import { getPageTitle } from "@/shared/config/site";
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

async function generateMetadata({ params }: EventDetailPageProps): Promise<Metadata> {
  const { city: slug, eventId } = await params;
  const context = getCachedEventDetailContext(slug);
  if (!context) return {};
  const event = getPublicCityEventById((await getCachedCityEvents(context)).events, eventId);

  if (!event) return {};

  // Fallback only — used when the provider supplied no description. "u" governs the locative, so
  // the nominative rendered "… u Podgorica." on every such event page.
  const description =
    event.description ??
    `Informacije o događaju ${event.title} u ${getCityName(context.city, "locative")}.`;

  return createPublicRouteMetadata({
    canonical: getEventDetailPath(context.city, event.id),
    description,
    ...(event.imageUrl ? { imageUrl: event.imageUrl } : {}),
    title: getPageTitle(getEventDetailPageTitle(event, context.city)),
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
