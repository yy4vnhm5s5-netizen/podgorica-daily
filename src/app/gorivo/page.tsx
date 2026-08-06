import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { createPublicRouteMetadata } from "@/app/public-route-metadata";
import { PlatformCityDiscovery } from "@/app/platform-city-discovery";
import { getFuelPrices } from "@/modules/fuel/infrastructure/gov-me-fuel-prices";
import {
  createFuelBreadcrumbStructuredData,
  serializeFuelStructuredData,
} from "@/modules/fuel/presentation/fuel-structured-data";
import { FuelPricesPage } from "@/modules/fuel/presentation/fuel-prices-page";
import { DashboardLayout } from "@/shared/components/layout/dashboard-layout";
import { getFuelPricesPath } from "@/shared/config/public-routes";
import { getPageTitle } from "@/shared/config/site";
import { isFeatureEnabled } from "@/shared/config/features";
import { getMainCity } from "@/shared/config/cities";
import { getTranslations } from "@/shared/lib/translations";

// Prices are read from the collector's snapshot, so the page renders per request rather than
// baking a calculation into a build artifact.
export const revalidate = 0;

// Evergreen: no year, no "danas", no price value — the URL and title stay valid across every
// weekly recalculation.
function generateMetadata(): Metadata {
  return createPublicRouteMetadata({
    canonical: getFuelPricesPath(),
    description:
      "Aktuelne cijene goriva u Crnoj Gori: Eurosuper 95, Eurosuper 98, Eurodizel i lož ulje, sa datumom važenja i prethodnim cijenama.",
    title: getPageTitle("Cijene goriva u Crnoj Gori"),
  });
}

async function FuelRoute() {
  // A disabled feature has no public URL at all, rather than an empty page search engines can index.
  if (!isFeatureEnabled("fuelPrices")) notFound();
  const result = await getFuelPrices();

  return (
    <DashboardLayout city={getMainCity()} homeHref="/" translations={getTranslations("me")}>
      {/* Server-rendered, so it is in the initial HTML a crawler reads. */}
      <script
        dangerouslySetInnerHTML={{
          __html: serializeFuelStructuredData(createFuelBreadcrumbStructuredData()),
        }}
        type="application/ld+json"
      />
      <FuelPricesPage locale="me" result={result} />
      <PlatformCityDiscovery />
    </DashboardLayout>
  );
}

export { generateMetadata };
export default FuelRoute;
