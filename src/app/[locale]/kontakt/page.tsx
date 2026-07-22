import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ContactPage } from "@/modules/contact/presentation/contact-page";
import { getContactTranslations } from "@/modules/contact/presentation/contact-translations";
import { getContactPath } from "@/shared/config/public-routes";
import { getPageTitle } from "@/shared/config/site";

interface ContactRouteProps {
  params: Promise<{ locale: string }>;
}

async function generateMetadata({ params }: ContactRouteProps): Promise<Metadata> {
  const { locale } = await params;
  if (locale !== "me") return {};
  const translations = getContactTranslations("me");

  return {
    alternates: { canonical: getContactPath("me") },
    description: translations.description,
    openGraph: { description: translations.description, title: getPageTitle(translations.heading) },
    title: { absolute: getPageTitle(translations.heading) },
    twitter: { description: translations.description, title: getPageTitle(translations.heading) },
  };
}

async function MontenegrinContactPage({ params }: ContactRouteProps) {
  const { locale } = await params;
  if (locale !== "me") notFound();
  return <ContactPage locale="me" />;
}

export { generateMetadata };
export default MontenegrinContactPage;
