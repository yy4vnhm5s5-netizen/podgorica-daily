import type { Metadata } from "next";
import { Clapperboard } from "lucide-react";
import { notFound } from "next/navigation";

import { isCityCinemaRouteAvailable, resolveActiveCityFeatureRoute } from "@/app/city-routing";
import { createPublicRouteMetadata } from "@/app/public-route-metadata";
import { getCityEvents } from "@/modules/events/application/get-city-events";
import { CineplexxProgrammeCard } from "@/modules/events/presentation/cineplexx-programme-card";
import { selectUpcomingCineplexxScreenings } from "@/modules/events/presentation/cineplexx-programme-ui-model";
import { DashboardLayout } from "@/shared/components/layout/dashboard-layout";
import { SectionTitle } from "@/shared/components/section-title";
import { getCityName } from "@/shared/config/cities";
import { getCinemaPath } from "@/shared/config/public-routes";
import { getPageTitle } from "@/shared/config/site";
import { getTranslations } from "@/shared/lib/translations";

export const revalidate = 0;

interface CinemaPageProps {
  params: Promise<{ city: string }>;
}

async function generateMetadata({ params }: CinemaPageProps): Promise<Metadata> {
  const { city: slug } = await params;
  const context = resolveActiveCityFeatureRoute(slug, "events");
  if (!context || !isCityCinemaRouteAvailable(context.city)) return {};

  // "u" takes the locative in Montenegrin, so the registry's locative form is required here —
  // `city.name` is the nominative and produced "Filmovi u Podgorica". Derived from the shared
  // city grammar model, so any future cinema city gets its own correct form with no change here.
  const cityName = getCityName(context.city, "locative");
  const title = `Filmovi u ${cityName}`;
  const description = `Aktuelni program Cineplexx bioskopa u ${cityName}.`;
  const metadataTitle = getPageTitle(title);

  return createPublicRouteMetadata({
    canonical: getCinemaPath(context.city),
    description,
    title: metadataTitle,
  });
}

async function CinemaPage({ params }: CinemaPageProps) {
  const { city: slug } = await params;
  const locale = "me" as const;
  const context = resolveActiveCityFeatureRoute(slug, "events");
  if (!context || !isCityCinemaRouteAvailable(context.city)) notFound();

  const result = await getCityEvents(context);
  const cinemaEvents = result.events.filter((event) => event.sourceId === "cineplexx-podgorica");
  // Every screening with an upcoming startsAt, across every day (not the ≤3-item,
  // today/tomorrow-only teaser selection used by the homepage card). No `limit` is passed to
  // CineplexxProgrammeCard below, so every movie with an upcoming screening is shown.
  const screenings = selectUpcomingCineplexxScreenings(cinemaEvents, { now: new Date() });
  const providerState = result.providers.find(
    (provider) => provider.id === "cineplexx-podgorica",
  )?.state;

  return (
    <DashboardLayout city={context.city} translations={getTranslations(locale)}>
      <section aria-labelledby="cinema-heading" className="space-y-6" id="filmovi">
        <SectionTitle
          as="h1"
          icon={Clapperboard}
          iconClassName="bg-gradient-to-br from-blue-400 to-blue-600 text-white shadow-blue-900/20"
          id="cinema-heading"
          title="Filmovi"
        />
        <CineplexxProgrammeCard events={screenings} locale={locale} state={providerState} />
      </section>
    </DashboardLayout>
  );
}

export { generateMetadata };
export default CinemaPage;
