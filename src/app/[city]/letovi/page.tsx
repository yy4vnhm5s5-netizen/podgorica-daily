import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  isCityPublicFeatureRouteAvailable,
  resolveActiveCityFeatureRoute,
} from "@/app/city-routing";
import { createPublicRouteMetadata } from "@/app/public-route-metadata";
import { getPodgoricaFlights } from "@/modules/flights/application/get-podgorica-flights";
import {
  AirportFlightsPage,
  podgoricaAirportName,
} from "@/modules/flights/presentation/airport-flights-page";
import { DashboardLayout } from "@/shared/components/layout/dashboard-layout";
import { getFlightsPath } from "@/shared/config/public-routes";
import { getPageTitle } from "@/shared/config/site";
import { getTranslations } from "@/shared/lib/translations";

export const revalidate = 0;

interface FlightsPageProps {
  params: Promise<{ city: string }>;
}

// The document title names the airport, because that is what the page is and what its own H1
// says. The previous "Letovi iz Podgorice" described the city instead, so the page's title never
// contained the word "aerodrom" at all while every search that reaches it is an airport lookup.
// Both directions are named because arrivals are searched for as often as the airport itself.
// The airport name comes from the presentation constant so the title and the H1 stay in step.
function getFlightsPageTitle() {
  return `${podgoricaAirportName} — dolasci i odlasci`;
}

async function generateMetadata({ params }: FlightsPageProps): Promise<Metadata> {
  const { city: slug } = await params;
  const context = resolveActiveCityFeatureRoute(slug, "flights");
  if (!context || !isCityPublicFeatureRouteAvailable(context.city, "flights")) return {};
  const title = getFlightsPageTitle();
  // Only what the feed actually carries: destination/origin, IATA flight number and the scheduled
  // time. No airline (the feed has no such field), no estimated or actual times, no gate, delay or
  // cancellation, and nothing described as live.
  const description = `Red letenja za ${podgoricaAirportName}: predstojeći dolasci i odlasci sa destinacijom, brojem leta i planiranim vremenom. Zvanični podaci Aerodroma Crne Gore.`;
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
  if (!isCityPublicFeatureRouteAvailable(context.city, "flights")) notFound();
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
