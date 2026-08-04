import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { resolveActiveCityFeatureRoute } from "@/app/city-routing";
import { createPublicRouteMetadata } from "@/app/public-route-metadata";
import { getSeaWaterQualityLocationBySlug } from "@/modules/sea-water-quality/application/get-sea-water-quality-history";
import { SeaWaterQualityLocationPage } from "@/modules/sea-water-quality/presentation/sea-water-quality-location-page";
import { gradeLabels } from "@/modules/sea-water-quality/presentation/sea-water-quality-grade-styles";
import { getSeaWaterQualityLocationSummary } from "@/modules/sea-water-quality/presentation/sea-water-quality-location-ui-model";
import {
  createSeaWaterQualityLocationBreadcrumbStructuredData,
  serializeSeaWaterQualityStructuredData,
} from "@/modules/sea-water-quality/presentation/sea-water-quality-location-structured-data";
import { DashboardLayout } from "@/shared/components/layout/dashboard-layout";
import { getCityName } from "@/shared/config/cities";
import { getSeaWaterQualityLocationPath } from "@/shared/config/public-routes";
import { getPageTitle } from "@/shared/config/site";
import { getTranslations } from "@/shared/lib/translations";

export const revalidate = 0;

interface SeaWaterQualityLocationRouteProps {
  params: Promise<{ city: string; slug: string }>;
}

const getCachedContext = cache((city: string) =>
  resolveActiveCityFeatureRoute(city, "seaWaterQuality"),
);
const getCachedLocation = cache(getSeaWaterQualityLocationBySlug);

async function generateMetadata({ params }: SeaWaterQualityLocationRouteProps): Promise<Metadata> {
  const { city: citySlug, slug } = await params;
  const context = getCachedContext(citySlug);
  if (!context) return {};
  const { location } = await getCachedLocation(context, slug);
  if (!location) return {};

  const title = `${location.displayName}, ${context.city.name} — kvalitet mora`;
  // The location is already loaded here (same cache() call the page uses), so appending the
  // newest verified measurement costs no extra read. Omitted when the point has no measurement,
  // rather than padded with a generic clause.
  const summary = getSeaWaterQualityLocationSummary(location);
  const latestGradeLabel = summary
    ? gradeLabels[summary.latest.grade].toLocaleLowerCase("sr-Latn-ME")
    : undefined;
  const description = [
    `Zvanični rezultati praćenja kvaliteta mora za kupalište ${location.displayName} u ${getCityName(context.city, "locative")}.`,
    ...(latestGradeLabel ? [`Posljednja ocjena: ${latestGradeLabel}.`] : []),
  ].join(" ");

  return createPublicRouteMetadata({
    canonical: getSeaWaterQualityLocationPath(context.city, location.canonicalSlug),
    description,
    title: getPageTitle(title),
  });
}

async function SeaWaterQualityLocationRoute({ params }: SeaWaterQualityLocationRouteProps) {
  const { city: citySlug, slug } = await params;
  const context = getCachedContext(citySlug);
  if (!context) notFound();
  const { location, result } = await getCachedLocation(context, slug);
  if (!location || !result.history) notFound();

  const structuredData = createSeaWaterQualityLocationBreadcrumbStructuredData({
    city: context.city,
    locationName: location.displayName,
    slug: location.canonicalSlug,
  });

  return (
    <DashboardLayout city={context.city} translations={getTranslations("me")}>
      <script
        dangerouslySetInnerHTML={{ __html: serializeSeaWaterQualityStructuredData(structuredData) }}
        type="application/ld+json"
      />
      <SeaWaterQualityLocationPage
        city={context.city}
        history={result.history}
        lastSuccessfulRefreshAt={result.lastSuccessfulRefreshAt}
        locale="me"
        location={location}
        sourceUrl="https://monitoring.morskodobro.me"
        state={result.state}
      />
    </DashboardLayout>
  );
}

export { generateMetadata };
export default SeaWaterQualityLocationRoute;
