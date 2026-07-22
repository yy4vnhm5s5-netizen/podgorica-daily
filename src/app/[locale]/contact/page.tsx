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
  if (locale !== "en") return {};
  const translations = getContactTranslations("en");

  return {
    alternates: { canonical: getContactPath("en") },
    description: translations.description,
    openGraph: { description: translations.description, title: getPageTitle(translations.heading) },
    title: { absolute: getPageTitle(translations.heading) },
    twitter: { description: translations.description, title: getPageTitle(translations.heading) },
  };
}

async function EnglishContactPage({ params }: ContactRouteProps) {
  const { locale } = await params;
  if (locale !== "en") notFound();
  return <ContactPage locale="en" />;
}

export { generateMetadata };
export default EnglishContactPage;
