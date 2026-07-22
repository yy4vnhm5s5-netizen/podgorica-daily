import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { resolveActiveCityFeatureRoute } from "@/app/city-routing";
import { createPublicRouteMetadata } from "@/app/public-route-metadata";
import { getPodgoricaFlights } from "@/modules/flights/application/get-podgorica-flights";
import { AirportFlightsPage } from "@/modules/flights/presentation/airport-flights-page";
import { DashboardLayout } from "@/shared/components/layout/dashboard-layout";
import { isFeatureEnabled } from "@/shared/config/features";
import { getFlightsPath } from "@/shared/config/public-routes";
import { getPageTitle } from "@/shared/config/site";
import { getTranslations } from "@/shared/lib/translations";

export const revalidate = 0;

interface FlightsPageProps {
  params: Promise<{ city: string }>;
}

async function generateMetadata({ params }: FlightsPageProps): Promise<Metadata> {
  const { city: slug } = await params;
  const context = resolveActiveCityFeatureRoute(slug, "flights");
  if (!context) return {};
  const title = `Letovi za ${context.city.name}`;
  const description = `Dolasci i odlasci za ${context.city.name} iz zvaničnih podataka aerodroma.`;
  const metadataTitle = getPageTitle(title);

  return createPublicRouteMetadata({
    canonical: getFlightsPath(context.city),
    description,
    title: metadataTitle,
  });
}

async function FlightsPage({ params }: FlightsPageProps) {
  const { city: slug } = await params;
  const locale = "me" as const;
  const context = resolveActiveCityFeatureRoute(slug, "flights");
  if (!context) notFound();
  if (!isFeatureEnabled("flights")) notFound();
  const result = await getPodgoricaFlights(context);

  return (
    <DashboardLayout city={context.city} translations={getTranslations(locale)}>
      <AirportFlightsPage
        flights={result.flights}
        lastSuccessfulRefreshAt={result.lastSuccessfulRefreshAt}
        locale={locale}
        state={result.state}
      />
    </DashboardLayout>
  );
}

export { generateMetadata };
export default FlightsPage;
