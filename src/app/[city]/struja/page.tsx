import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { resolveActiveCityFeatureRoute } from "@/app/city-routing";
import { createPublicRouteMetadata } from "@/app/public-route-metadata";
import { getPowerOutages } from "@/modules/city-alerts/application/get-power-outages";
import { PowerOutagesPage } from "@/modules/city-alerts/presentation/power-outages-page";
import { getPowerOutagesTranslations } from "@/modules/city-alerts/presentation/power-outages-translations";
import { DashboardLayout } from "@/shared/components/layout/dashboard-layout";
import { getElectricityPath } from "@/shared/config/public-routes";
import { getPageTitle } from "@/shared/config/site";
import { getTranslations } from "@/shared/lib/translations";

interface ElectricityPageProps {
  params: Promise<{ city: string }>;
}

async function generateMetadata({ params }: ElectricityPageProps): Promise<Metadata> {
  const { city: slug } = await params;
  const context = resolveActiveCityFeatureRoute(slug, "electricity");
  if (!context) return {};
  // Taken from the page's own dictionary rather than restated here. The route used to keep a
  // second, vaguer description ("iz zvaničnih servisnih informacija") that omitted the source by
  // name while the page itself credited CEDIS — two strings saying nearly the same thing, one of
  // them weaker in exactly the place a searcher sees it. The title is identical either way.
  const { description, title } = getPowerOutagesTranslations("me", context.city);

  return createPublicRouteMetadata({
    canonical: getElectricityPath(context.city),
    description,
    title: getPageTitle(title),
  });
}

export const revalidate = 60;

async function ElectricityPage({ params }: ElectricityPageProps) {
  const { city: slug } = await params;
  const locale = "me" as const;
  const translations = getTranslations(locale);
  const context = resolveActiveCityFeatureRoute(slug, "electricity");
  if (!context) notFound();
  const result = await getPowerOutages(context);

  return (
    <DashboardLayout city={context.city} translations={translations}>
      <PowerOutagesPage city={context.city} locale={locale} result={result} />
    </DashboardLayout>
  );
}

export { generateMetadata };
export default ElectricityPage;
