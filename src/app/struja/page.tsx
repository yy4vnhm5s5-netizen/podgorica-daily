import type { Metadata } from "next";

import { getDefaultCityContext } from "@/config/city-context";
import { getPowerOutages } from "@/modules/city-alerts/application/get-power-outages";
import { PowerOutagesPage } from "@/modules/city-alerts/presentation/power-outages-page";
import { DashboardLayout } from "@/shared/components/layout/dashboard-layout";
import { siteConfig } from "@/shared/config/site";
import { getTranslations } from "@/shared/lib/translations";

const title = "Planirana isključenja struje u Podgorici";
const description =
  "Aktuelna i najavljena planirana isključenja struje u Podgorici iz zvaničnih servisnih informacija CEDIS-a.";

export const metadata: Metadata = {
  alternates: { canonical: "/struja" },
  description,
  openGraph: { description, title: `${title} | ${siteConfig.name}` },
  title: { absolute: `${title} | ${siteConfig.name}` },
  twitter: { description, title: `${title} | ${siteConfig.name}` },
};

export const revalidate = 60;

async function ElectricityPage() {
  const locale = "me" as const;
  const translations = getTranslations(locale);
  const result = await getPowerOutages(getDefaultCityContext(locale));

  return (
    <DashboardLayout locale={locale} translations={translations}>
      <PowerOutagesPage locale={locale} result={result} />
    </DashboardLayout>
  );
}

export default ElectricityPage;
