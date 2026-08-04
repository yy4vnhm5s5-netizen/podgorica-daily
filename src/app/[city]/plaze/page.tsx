import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  isCityPublicFeatureRouteAvailable,
  resolveActiveCityFeatureRoute,
} from "@/app/city-routing";
import { createPublicRouteMetadata } from "@/app/public-route-metadata";
import { getBudvaSeaWaterQuality } from "@/modules/sea-water-quality/application/get-budva-sea-water-quality";
import { getSeaWaterQualityLocationSlugs } from "@/modules/sea-water-quality/application/get-sea-water-quality-history";
import { SeaWaterQualityPage } from "@/modules/sea-water-quality/presentation/sea-water-quality-page";
import { DashboardLayout } from "@/shared/components/layout/dashboard-layout";
import { getCityName } from "@/shared/config/cities";
import { getSeaWaterQualityPath } from "@/shared/config/public-routes";
import { getPageTitle } from "@/shared/config/site";
import { getTranslations } from "@/shared/lib/translations";

export const revalidate = 0;

interface PlazePageProps {
  params: Promise<{ city: string }>;
}

async function generateMetadata({ params }: PlazePageProps): Promise<Metadata> {
  const { city: slug } = await params;
  const context = resolveActiveCityFeatureRoute(slug, "seaWaterQuality");
  if (!context || !isCityPublicFeatureRouteAvailable(context.city, "seaWaterQuality")) return {};
  // "Plaže <grad>" put the city in the nominative with no preposition, so production rendered
  // "Plaže Bar i kvalitet mora" while the H1 directly below already read "Plaže u Baru…".
  // Same construction as the H1 now, from the same registry accessor.
  const title = `Plaže u ${getCityName(context.city, "locative")} i kvalitet mora`;
  const description = `Zvanično praćenje sanitarnog kvaliteta mora na javnim plažama u ${context.city.locativeName ?? context.city.name} — aktuelne ocjene kvaliteta i datumi uzorkovanja za svako kupalište.`;

  return createPublicRouteMetadata({
    canonical: getSeaWaterQualityPath(context.city),
    description,
    title: getPageTitle(title),
  });
}

async function PlazePage({ params }: PlazePageProps) {
  const { city: slug } = await params;
  const locale = "me" as const;
  const context = resolveActiveCityFeatureRoute(slug, "seaWaterQuality");
  if (!context) notFound();
  if (!isCityPublicFeatureRouteAvailable(context.city, "seaWaterQuality")) notFound();
  // getBudvaSeaWaterQuality is legacy-named but city-generic — it resolves context.city's own
  // cache (Budva, Tivat, ...), not always Budva's.
  const [result, locationSlugs] = await Promise.all([
    getBudvaSeaWaterQuality(context),
    getSeaWaterQualityLocationSlugs(context),
  ]);

  return (
    <DashboardLayout city={context.city} translations={getTranslations(locale)}>
      <SeaWaterQualityPage
        city={context.city}
        locale={locale}
        locationSlugs={locationSlugs}
        result={result}
      />
    </DashboardLayout>
  );
}

export { generateMetadata };
export default PlazePage;
