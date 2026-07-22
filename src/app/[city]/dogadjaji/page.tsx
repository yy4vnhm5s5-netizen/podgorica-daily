import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { createPublicRouteMetadata } from "@/app/public-route-metadata";
import { getCityEvents } from "@/modules/events/application/get-city-events";
import { resolveActiveCityFeatureRoute } from "@/app/city-routing";
import { EventsList } from "@/modules/events/presentation/events-list";
import { getEventsTranslations } from "@/modules/events/presentation/events-translations";
import {
  filterEventsForUi,
  getCityEventsForPublicListing,
  parseEventsUiFilters,
} from "@/modules/events/presentation/events-ui-model";
import { ErrorState } from "@/shared/components/error-state";
import { DashboardLayout } from "@/shared/components/layout/dashboard-layout";
import { SectionTitle } from "@/shared/components/section-title";
import { getPageTitle } from "@/shared/config/site";
import { getEventsPath } from "@/shared/config/public-routes";
import { getTranslations } from "@/shared/lib/translations";

interface EventsPageProps {
  params: Promise<{ city: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

// Events are collector-managed cache snapshots. Do not persist a separate Next.js
// route snapshot, which could disagree with links rendered on the dashboard.
export const revalidate = 0;

async function generateMetadata({ params }: EventsPageProps): Promise<Metadata> {
  const { city: slug } = await params;
  const context = resolveActiveCityFeatureRoute(slug, "events");
  if (!context) return {};
  const translations = getEventsTranslations("me");
  const title = getPageTitle(translations.heading);

  return createPublicRouteMetadata({
    canonical: getEventsPath(context.city),
    description: translations.supportingText,
    title,
  });
}

async function EventsPage({ params, searchParams }: EventsPageProps) {
  const { city: slug } = await params;
  const locale = "me" as const;
  const translations = getTranslations(locale);
  const eventTranslations = getEventsTranslations(locale);
  const filters = parseEventsUiFilters(await searchParams);
  const context = resolveActiveCityFeatureRoute(slug, "events");
  if (!context) notFound();

  try {
    const eventsReadModel = await getCityEvents(context);
    const cityEvents = getCityEventsForPublicListing(eventsReadModel.events);
    const cityEventProviders = eventsReadModel.providers.filter(
      (provider) => provider.id !== "cineplexx-podgorica",
    );
    const events = filterEventsForUi(cityEvents, context, filters);
    const allUnavailable =
      cityEventProviders.length > 0 &&
      cityEventProviders.every(({ state }) => state === "unavailable");
    const hasUnavailableProvider = cityEventProviders.some(
      ({ state }) => state === "unavailable" || state === "stale",
    );

    return (
      <DashboardLayout city={context.city} translations={translations}>
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
            allEvents={cityEvents}
            city={context.city}
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
      <DashboardLayout city={context.city} translations={translations}>
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
