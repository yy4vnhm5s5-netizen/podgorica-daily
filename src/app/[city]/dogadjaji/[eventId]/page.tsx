import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { resolveActiveCityFeatureRoute } from "@/app/city-routing";
import { createPublicRouteMetadata } from "@/app/public-route-metadata";
import { getCityEvents } from "@/modules/events/application/get-city-events";
import { EventDetail } from "@/modules/events/presentation/event-detail";
import {
  createEventStructuredData,
  serializeStructuredData,
} from "@/modules/events/presentation/event-structured-data";
import { getPublicCityEventById } from "@/modules/events/presentation/events-ui-model";
import { DashboardLayout } from "@/shared/components/layout/dashboard-layout";
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

async function generateMetadata({ params }: EventDetailPageProps): Promise<Metadata> {
  const { city: slug, eventId } = await params;
  const context = resolveActiveCityFeatureRoute(slug, "events");
  if (!context) return {};
  const event = getPublicCityEventById((await getCityEvents(context)).events, eventId);

  if (!event) return {};

  const description =
    event.description ?? `Informacije o događaju ${event.title} u ${context.city.name}.`;

  return createPublicRouteMetadata({
    canonical: getEventDetailPath(context.city, event.id),
    description,
    ...(event.imageUrl ? { imageUrl: event.imageUrl } : {}),
    title: getPageTitle(event.title),
  });
}

async function EventDetailPage({ params }: EventDetailPageProps) {
  const { city: slug, eventId } = await params;
  const locale = "me" as const;
  const context = resolveActiveCityFeatureRoute(slug, "events");
  if (!context) notFound();
  const eventsReadModel = await getCityEvents(context);
  const event = getPublicCityEventById(eventsReadModel.events, eventId);

  if (!event) notFound();
  const structuredData = createEventStructuredData(event);

  return (
    <DashboardLayout city={context.city} translations={getTranslations(locale)}>
      {structuredData ? (
        <script
          dangerouslySetInnerHTML={{ __html: serializeStructuredData(structuredData) }}
          type="application/ld+json"
        />
      ) : null}
      <EventDetail city={context.city} event={event} locale={locale} />
    </DashboardLayout>
  );
}

export { generateMetadata };
export default EventDetailPage;
