import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getPodgoricaFlights } from "@/modules/flights/application/get-podgorica-flights";
import { AirportFlightsPage } from "@/modules/flights/presentation/airport-flights-page";
import { DashboardLayout } from "@/shared/components/layout/dashboard-layout";
import { isFeatureEnabled } from "@/shared/config/features";
import { getPageTitle } from "@/shared/config/site";
import { getTranslations } from "@/shared/lib/translations";

const title = "Letovi Aerodroma Podgorica";
const description =
  "Dolasci i odlasci na Aerodromu Podgorica iz zvaničnih podataka Aerodroma Crne Gore.";

export const revalidate = 0;

function generateMetadata(): Metadata {
  const metadataTitle = getPageTitle(title);

  return {
    alternates: { canonical: "/letovi" },
    description,
    openGraph: { description, title: metadataTitle },
    title: { absolute: metadataTitle },
    twitter: { description, title: metadataTitle },
  };
}

async function FlightsPage() {
  if (!isFeatureEnabled("flights")) notFound();
  const locale = "me" as const;
  const result = await getPodgoricaFlights();

  return (
    <DashboardLayout translations={getTranslations(locale)}>
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
