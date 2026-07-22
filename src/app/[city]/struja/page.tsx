import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { resolveActiveCityFeatureRoute } from "@/app/city-routing";
import { createPublicRouteMetadata } from "@/app/public-route-metadata";
import { getPowerOutages } from "@/modules/city-alerts/application/get-power-outages";
import { PowerOutagesPage } from "@/modules/city-alerts/presentation/power-outages-page";
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
  const title = `Planirana isključenja struje u ${context.city.name}`;
  const description = `Aktuelna i najavljena planirana isključenja struje u ${context.city.name} iz zvaničnih servisnih informacija.`;

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
      <PowerOutagesPage locale={locale} result={result} />
    </DashboardLayout>
  );
}

export { generateMetadata };
export default ElectricityPage;
