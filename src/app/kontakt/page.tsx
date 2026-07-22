import type { Metadata } from "next";
import { ContactPage } from "@/modules/contact/presentation/contact-page";
import { getContactTranslations } from "@/modules/contact/presentation/contact-translations";
import { getContactPath } from "@/shared/config/public-routes";
import { getPageTitle } from "@/shared/config/site";

function generateMetadata(): Metadata {
  const translations = getContactTranslations("me");

  return {
    alternates: { canonical: getContactPath() },
    description: translations.description,
    openGraph: { description: translations.description, title: getPageTitle(translations.heading) },
    title: { absolute: getPageTitle(translations.heading) },
    twitter: { description: translations.description, title: getPageTitle(translations.heading) },
  };
}

function ContactRoute() {
  return <ContactPage locale="me" />;
}

export { generateMetadata };
export default ContactRoute;
