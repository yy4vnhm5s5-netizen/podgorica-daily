import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ContactPage } from "@/modules/contact/presentation/contact-page";
import { getContactTranslations } from "@/modules/contact/presentation/contact-translations";
import { getContactLocaleAlternates, getContactPath } from "@/shared/config/public-routes";

interface ContactRouteProps {
  params: Promise<{ locale: string }>;
}

async function generateMetadata({ params }: ContactRouteProps): Promise<Metadata> {
  const { locale } = await params;
  if (locale !== "me") return {};
  const translations = getContactTranslations("me");

  return {
    alternates: { canonical: getContactPath("me"), languages: getContactLocaleAlternates() },
    description: translations.description,
    openGraph: { description: translations.description, title: translations.heading },
    title: translations.heading,
  };
}

async function MontenegrinContactPage({ params }: ContactRouteProps) {
  const { locale } = await params;
  if (locale !== "me") notFound();
  return <ContactPage locale="me" />;
}

export { generateMetadata };
export default MontenegrinContactPage;
