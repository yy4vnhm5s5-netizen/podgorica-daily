import type { Metadata } from "next";
import { LegalPage } from "@/modules/legal/presentation/legal-page";
import { createPublicRouteMetadata } from "@/app/public-route-metadata";
import { getMainCity } from "@/shared/config/cities";
import { getPrivacyPolicyPath } from "@/shared/config/public-routes";
import { getPageTitle } from "@/shared/config/site";

function generateMetadata(): Metadata {
  const title = "Politika privatnosti";
  const description = "Politika privatnosti i način obrade podataka posjetilaca sajta Gradom.me.";
  return createPublicRouteMetadata({
    canonical: getPrivacyPolicyPath(),
    description,
    title: getPageTitle(title),
  });
}

function PrivacyPolicyPage() {
  return <LegalPage city={getMainCity()} document="privacy" />;
}

export { generateMetadata };
export default PrivacyPolicyPage;
