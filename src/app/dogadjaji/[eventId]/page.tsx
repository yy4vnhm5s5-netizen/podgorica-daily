import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getDefaultCityContext } from "@/config/city-context";
import { getCityEvents } from "@/modules/events/application/get-city-events";
import { EventDetail } from "@/modules/events/presentation/event-detail";
import {
  createEventStructuredData,
  serializeStructuredData,
} from "@/modules/events/presentation/event-structured-data";
import { getPublicCityEventById } from "@/modules/events/presentation/events-ui-model";
import { DashboardLayout } from "@/shared/components/layout/dashboard-layout";
import { getPageTitle } from "@/shared/config/site";
import { getTranslations } from "@/shared/lib/translations";

interface EventDetailPageProps {
  params: Promise<{ eventId: string }>;
}

// Use the current collector-managed snapshot for the same public event set used
// by the dashboard and listing. This avoids a stale route-cache link resolving
// against a newer cache snapshot after a refresh.
export const revalidate = 0;

async function generateMetadata({ params }: EventDetailPageProps): Promise<Metadata> {
  const { eventId } = await params;
  const context = getDefaultCityContext("me");
  const event = getPublicCityEventById((await getCityEvents(context)).events, eventId);

  if (!event) return {};

  return {
    alternates: {
      canonical: `/dogadjaji/${encodeURIComponent(event.id)}`,
    },
    description: event.description,
    openGraph: {
      description: event.description,
      images: event.imageUrl ? [{ url: event.imageUrl }] : undefined,
      title: getPageTitle(event.title),
    },
    title: { absolute: getPageTitle(event.title) },
    twitter: { description: event.description, title: getPageTitle(event.title) },
  };
}

async function EventDetailPage({ params }: EventDetailPageProps) {
  const { eventId } = await params;
  const locale = "me" as const;
  const context = getDefaultCityContext(locale);
  const eventsReadModel = await getCityEvents(context);
  const event = getPublicCityEventById(eventsReadModel.events, eventId);

  if (!event) notFound();
  const structuredData = createEventStructuredData(event);

  return (
    <DashboardLayout translations={getTranslations(locale)}>
      {structuredData ? (
        <script
          dangerouslySetInnerHTML={{ __html: serializeStructuredData(structuredData) }}
          type="application/ld+json"
        />
      ) : null}
      <EventDetail event={event} locale={locale} />
    </DashboardLayout>
  );
}

export { generateMetadata };
export default EventDetailPage;
