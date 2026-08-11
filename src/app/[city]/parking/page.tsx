import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  isCityPublicFeatureRouteAvailable,
  resolveActiveCityFeatureRoute,
} from "@/app/city-routing";
import { createPublicRouteMetadata } from "@/app/public-route-metadata";
import { getParkingAvailability } from "@/modules/parking/application/get-parking-availability";
import { ParkingPage } from "@/modules/parking/presentation/parking-page";
import { DashboardLayout } from "@/shared/components/layout/dashboard-layout";
import { getParkingPath } from "@/shared/config/public-routes";
import { getPageTitle } from "@/shared/config/site";
import { getTranslations } from "@/shared/lib/translations";

export const revalidate = 0;

interface ParkingRouteProps {
  params: Promise<{ city: string }>;
}

async function generateMetadata({ params }: ParkingRouteProps): Promise<Metadata> {
  const { city: slug } = await params;
  const context = resolveActiveCityFeatureRoute(slug, "parking");
  if (!context || !isCityPublicFeatureRouteAvailable(context.city, "parking")) return {};

  return createPublicRouteMetadata({
    canonical: getParkingPath(context.city),
    description:
      "Parking u Podgorici: javne lokacije Parking servisa Podgorica i broj slobodnih mjesta kada je izvorni podatak dovoljno svjež.",
    title: getPageTitle("Parking Podgorica — slobodna parking mjesta"),
  });
}

async function ParkingRoute({ params }: ParkingRouteProps) {
  const { city: slug } = await params;
  const context = resolveActiveCityFeatureRoute(slug, "parking");
  if (!context || !isCityPublicFeatureRouteAvailable(context.city, "parking")) notFound();

  const locale = "me" as const;
  const result = await getParkingAvailability();

  return (
    <DashboardLayout city={context.city} translations={getTranslations(locale)}>
      <ParkingPage city={context.city} locale={locale} result={result} />
    </DashboardLayout>
  );
}

export { generateMetadata };
export default ParkingRoute;
