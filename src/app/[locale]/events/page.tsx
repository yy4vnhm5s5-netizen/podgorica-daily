import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getCityEvents } from "@/modules/events/application/get-city-events";
import { getDefaultCityContext } from "@/config/city-context";
import { EventsList } from "@/modules/events/presentation/events-list";
import { getEventsTranslations } from "@/modules/events/presentation/events-translations";
import {
  filterEventsForUi,
  parseEventsUiFilters,
} from "@/modules/events/presentation/events-ui-model";
import { ErrorState } from "@/shared/components/error-state";
import { DashboardLayout } from "@/shared/components/layout/dashboard-layout";
import { SectionTitle } from "@/shared/components/section-title";
import { getLocaleAlternates, isLocale, type Locale } from "@/shared/config/locale";
import { getTranslations } from "@/shared/lib/translations";

interface EventsPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

async function generateMetadata({ params }: Pick<EventsPageProps, "params">): Promise<Metadata> {
  const { locale: localeParam } = await params;
  if (!isLocale(localeParam)) return {};
  const translations = getEventsTranslations(localeParam);

  return {
    alternates: { canonical: `/${localeParam}/events`, languages: getLocaleAlternates("/events") },
    description: translations.supportingText,
    openGraph: { description: translations.supportingText, title: translations.heading },
    title: translations.heading,
  };
}

async function EventsPage({ params, searchParams }: EventsPageProps) {
  const { locale: localeParam } = await params;
  if (!isLocale(localeParam)) notFound();
  const locale = localeParam as Locale;
  const translations = getTranslations(locale);
  const eventTranslations = getEventsTranslations(locale);
  const filters = parseEventsUiFilters(await searchParams);
  const context = getDefaultCityContext(locale);

  try {
    const eventsReadModel = await getCityEvents(context);
    const events = filterEventsForUi(eventsReadModel.events, context, filters);
    const allUnavailable =
      eventsReadModel.providers.length > 0 &&
      eventsReadModel.providers.every(({ state }) => state === "unavailable");
    const hasUnavailableProvider = eventsReadModel.providers.some(
      ({ state }) => state === "unavailable" || state === "stale",
    );

    return (
      <DashboardLayout locale={locale} translations={translations}>
        <section className="space-y-8" id="events">
          <SectionTitle title={eventTranslations.heading} />
          {allUnavailable ? (
            <ErrorState
              description={eventTranslations.allEventsUnavailableDescription}
              title={eventTranslations.allEventsUnavailable}
            />
          ) : null}
          {hasUnavailableProvider && !allUnavailable ? (
            <p
              className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"
              role="status"
            >
              {eventTranslations.unavailableSources}
            </p>
          ) : null}
          <EventsList
            allEvents={eventsReadModel.events}
            events={events}
            filters={filters}
            locale={locale}
            timezone={context.timezone}
          />
        </section>
      </DashboardLayout>
    );
  } catch {
    return (
      <DashboardLayout locale={locale} translations={translations}>
        <section className="space-y-8" id="events">
          <SectionTitle title={eventTranslations.heading} />
          <ErrorState
            description={eventTranslations.allEventsUnavailableDescription}
            title={eventTranslations.allEventsUnavailable}
          />
        </section>
      </DashboardLayout>
    );
  }
}

export { generateMetadata };
export default EventsPage;
