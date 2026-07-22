import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getGoingOutEvents } from "@/modules/going-out/application/get-going-out-events";
import { GoingOutPage } from "@/modules/going-out/presentation/going-out-page";
import { DashboardLayout } from "@/shared/components/layout/dashboard-layout";
import { isFeatureEnabled } from "@/shared/config/features";
import { getPageTitle } from "@/shared/config/site";
import { getTranslations } from "@/shared/lib/translations";

const title = "Izlasci u Podgorici – koncerti, žurke i noćni život";
const description =
  "Pronađite koncerte, DJ večeri, svirke, žurke i druge izlaske u Podgorici na jednom mjestu.";

export const revalidate = 0;

function generateMetadata(): Metadata {
  const metadataTitle = getPageTitle(title);

  return {
    alternates: { canonical: "/izlasci" },
    description,
    openGraph: { description, title: metadataTitle },
    title: { absolute: metadataTitle },
    twitter: { description, title: metadataTitle },
  };
}

async function GoingOutRoute() {
  if (!isFeatureEnabled("goingOut")) notFound();
  const locale = "me" as const;
  const result = await getGoingOutEvents();

  return (
    <DashboardLayout translations={getTranslations(locale)}>
      <GoingOutPage events={result.events} locale={locale} state={result.state} />
    </DashboardLayout>
  );
}

export { generateMetadata };
export default GoingOutRoute;
