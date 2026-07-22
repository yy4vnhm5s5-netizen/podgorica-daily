import type { Metadata } from "next";
import { LegalPage } from "@/modules/legal/presentation/legal-page";
import { getPrivacyPolicyPath } from "@/shared/config/public-routes";
import { getPageTitle } from "@/shared/config/site";

function generateMetadata(): Metadata {
  const title = "Politika privatnosti";
  const description = "Politika privatnosti i način obrade podataka posjetilaca sajta Gradom.me.";
  return {
    alternates: { canonical: getPrivacyPolicyPath() },
    description,
    openGraph: { description, title: getPageTitle(title) },
    title: { absolute: getPageTitle(title) },
    twitter: { description, title: getPageTitle(title) },
  };
}

function PrivacyPolicyPage() {
  return <LegalPage document="privacy" />;
}

export { generateMetadata };
export default PrivacyPolicyPage;
