import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LegalPage } from "@/modules/legal/presentation/legal-page";
import { getPrivacyPolicyPath } from "@/shared/config/public-routes";
import { getPageTitle } from "@/shared/config/site";

interface PrivacyPolicyPageProps {
  params: Promise<{ locale: string }>;
}

async function generateMetadata({ params }: PrivacyPolicyPageProps): Promise<Metadata> {
  const { locale } = await params;
  if (locale !== "me") return {};

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

async function PrivacyPolicyPage({ params }: PrivacyPolicyPageProps) {
  const { locale } = await params;
  if (locale !== "me") notFound();
  return <LegalPage document="privacy" />;
}

export { generateMetadata };
export default PrivacyPolicyPage;
