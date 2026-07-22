import type { Metadata } from "next";
import { LegalPage } from "@/modules/legal/presentation/legal-page";
import { getTermsOfUsePath } from "@/shared/config/public-routes";
import { getPageTitle } from "@/shared/config/site";

function generateMetadata(): Metadata {
  const title = "Uslovi korišćenja";
  const description = "Uslovi korišćenja javno dostupnih sadržaja i usluga na sajtu Gradom.me.";
  return {
    alternates: { canonical: getTermsOfUsePath() },
    description,
    openGraph: { description, title: getPageTitle(title) },
    title: { absolute: getPageTitle(title) },
    twitter: { description, title: getPageTitle(title) },
  };
}

function TermsPage() {
  return <LegalPage document="terms" />;
}

export { generateMetadata };
export default TermsPage;
