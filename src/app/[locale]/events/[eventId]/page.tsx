import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getDefaultCityContext } from "@/config/city-context";
import { getCityEvents } from "@/modules/events/application/get-city-events";
import { EventDetail } from "@/modules/events/presentation/event-detail";
import {
  createEventStructuredData,
  serializeStructuredData,
} from "@/modules/events/presentation/event-structured-data";
import { DashboardLayout } from "@/shared/components/layout/dashboard-layout";
import { getLocaleAlternates, isLocale, type Locale } from "@/shared/config/locale";
import { getTranslations } from "@/shared/lib/translations";

interface EventDetailPageProps {
  params: Promise<{ eventId: string; locale: string }>;
}

async function generateMetadata({ params }: EventDetailPageProps): Promise<Metadata> {
  const { eventId, locale: localeParam } = await params;
  if (!isLocale(localeParam)) return {};
  const context = getDefaultCityContext(localeParam);
  const event = (await getCityEvents(context)).events.find((candidate) => candidate.id === eventId);

  if (!event) return {};

  return {
    alternates: {
      canonical: `/${localeParam}/events/${encodeURIComponent(event.id)}`,
      languages: getLocaleAlternates(`/events/${encodeURIComponent(event.id)}`),
    },
    description: event.description,
    openGraph: {
      description: event.description,
      images: event.imageUrl ? [{ url: event.imageUrl }] : undefined,
      title: event.title,
    },
    title: event.title,
  };
}

async function EventDetailPage({ params }: EventDetailPageProps) {
  const { eventId, locale: localeParam } = await params;
  if (!isLocale(localeParam)) notFound();
  const locale = localeParam as Locale;
  const context = getDefaultCityContext(locale);
  const eventsReadModel = await getCityEvents(context);
  const event = eventsReadModel.events.find((candidate) => candidate.id === eventId);

  if (!event) notFound();
  const structuredData = createEventStructuredData(event);

  return (
    <DashboardLayout locale={locale} translations={getTranslations(locale)}>
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
