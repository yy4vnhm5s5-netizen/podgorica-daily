import type { Metadata } from "next";
import { ContactPage } from "@/modules/contact/presentation/contact-page";
import { createPublicRouteMetadata } from "@/app/public-route-metadata";
import { getContactTranslations } from "@/modules/contact/presentation/contact-translations";
import { getMainCity } from "@/shared/config/cities";
import { getContactPath } from "@/shared/config/public-routes";

function generateMetadata(): Metadata {
  const translations = getContactTranslations();

  return createPublicRouteMetadata({
    canonical: getContactPath(),
    description: translations.description,
    siteName: "Gradom.me",
    title: translations.metadataTitle,
  });
}

function ContactRoute() {
  return <ContactPage city={getMainCity()} locale="me" />;
}

export { generateMetadata };
export default ContactRoute;
