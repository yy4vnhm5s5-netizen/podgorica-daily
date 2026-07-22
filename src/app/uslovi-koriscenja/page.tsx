import type { Metadata } from "next";
import { LegalPage } from "@/modules/legal/presentation/legal-page";
import { createPublicRouteMetadata } from "@/app/public-route-metadata";
import { getMainCity } from "@/shared/config/cities";
import { getTermsOfUsePath } from "@/shared/config/public-routes";
import { getPageTitle } from "@/shared/config/site";

function generateMetadata(): Metadata {
  const title = "Uslovi korišćenja";
  const description = "Uslovi korišćenja javno dostupnih sadržaja i usluga na sajtu Gradom.me.";
  return createPublicRouteMetadata({
    canonical: getTermsOfUsePath(),
    description,
    title: getPageTitle(title),
  });
}

function TermsPage() {
  return <LegalPage city={getMainCity()} document="terms" />;
}

export { generateMetadata };
export default TermsPage;
