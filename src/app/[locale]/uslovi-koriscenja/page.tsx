import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LegalPage } from "@/modules/legal/presentation/legal-page";
import { getTermsOfUsePath } from "@/shared/config/public-routes";
import { getPageTitle } from "@/shared/config/site";

interface TermsPageProps {
  params: Promise<{ locale: string }>;
}

async function generateMetadata({ params }: TermsPageProps): Promise<Metadata> {
  const { locale } = await params;
  if (locale !== "me") return {};

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

async function TermsPage({ params }: TermsPageProps) {
  const { locale } = await params;
  if (locale !== "me") notFound();
  return <LegalPage document="terms" />;
}

export { generateMetadata };
export default TermsPage;
