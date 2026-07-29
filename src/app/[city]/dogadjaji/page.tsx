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
import { getCityName } from "@/shared/config/cities";
import { getPageTitle } from "@/shared/config/site";
import { getEventsPath } from "@/shared/config/public-routes";
import { getTranslations } from "@/shared/lib/translations";
import type { City } from "@/shared/types/city";

// eventTranslations.heading is a single shared string ("Događaji u Podgorici") also used by
// HomepageEventsCard's dashboard-card heading, which this page must not affect — so the page
// title and H1 are built locally from the resolved city instead of reading .heading. The
// locative form matches every other per-city page title in this app (see plaze/page.tsx,
// filmovi/page.tsx) and reduces to the exact existing string for Podgorica.
function getEventsPageHeading(cityName: string) {
  return `Događaji u ${cityName}`;
}

// eventTranslations.supportingText is Podgorica's own existing description ("...zvaničnih
// podgoričkih izvora.") — kept byte-identical for Podgorica rather than reused for other cities.
// Every other city gets a generic description built from its own name instead of a copy of
// Podgorica's, using the same safe locative-name construction as the heading above (no invented
// per-city adjective, e.g. a guessed "tivatski").
function getEventsPageDescription(city: City, podgoricaDescription: string) {
  return city.id === "podgorica"
    ? podgoricaDescription
    : `Provjereni programi iz zvaničnih izvora u ${getCityName(city, "locative")}.`;
}

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
  const title = getPageTitle(getEventsPageHeading(getCityName(context.city, "locative")));

  return createPublicRouteMetadata({
    canonical: getEventsPath(context.city),
    description: getEventsPageDescription(context.city, translations.supportingText),
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
  const heading = getEventsPageHeading(getCityName(context.city, "locative"));

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
          <SectionTitle as="h1" title={heading} />
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
          <SectionTitle as="h1" title={heading} />
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
