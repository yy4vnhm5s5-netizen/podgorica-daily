import type { GoingOutEvent } from "../domain/going-out-event.ts";
import { getCityPath, getGoingOutDetailPath, getGoingOutPath } from "@/shared/config/public-routes";
import { siteConfig } from "@/shared/config/site";
import { normalizeMetadataText, truncateMetadataText } from "@/shared/lib/metadata-text";
import type { City } from "@/shared/types/city";

const maximumGoingOutStructuredDataDescriptionLength = 500;

interface GoingOutDetailStructuredData {
  "@context": "https://schema.org";
  "@type": "Event" | "MusicEvent";
  description?: string;
  image?: string;
  isAccessibleForFree?: true;
  location: {
    "@type": "Place";
    address: {
      "@type": "PostalAddress";
      addressCountry: "ME";
      addressLocality: string;
      streetAddress?: string;
    };
    name: string;
  };
  name: string;
  organizer?: { "@type": "Organization"; name: string };
  performer?: Array<{ "@type": "PerformingGroup"; name: string }>;
  sameAs: string;
  startDate: string;
  url: string;
}

interface GoingOutBreadcrumbStep {
  href: string;
  name: string;
  url: string;
}

interface GoingOutDetailBreadcrumbStructuredData {
  "@context": "https://schema.org";
  "@type": "BreadcrumbList";
  itemListElement: Array<{ "@type": "ListItem"; item: string; name: string; position: number }>;
}

function createGoingOutDetailStructuredData(
  event: GoingOutEvent,
  city: City,
): GoingOutDetailStructuredData | undefined {
  const startDate = getStructuredDataStartDate(event);
  const address = event.address?.trim();
  const venue = event.venue?.trim();
  if (!startDate || !venue || !address) return undefined;

  return {
    "@context": "https://schema.org",
    "@type": isReliablyMusicEvent(event) ? "MusicEvent" : "Event",
    ...(event.description
      ? {
          description: truncateMetadataText(
            normalizeMetadataText(event.description) ?? event.description,
            maximumGoingOutStructuredDataDescriptionLength,
          ),
        }
      : {}),
    ...(event.imageUrl ? { image: event.imageUrl } : {}),
    ...(event.isFree ? { isAccessibleForFree: true as const } : {}),
    location: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressCountry: "ME",
        addressLocality: city.name,
        streetAddress: address,
      },
      name: venue,
    },
    name: event.title,
    ...(event.organizer
      ? { organizer: { "@type": "Organization" as const, name: event.organizer } }
      : {}),
    ...(event.performers
      ? {
          performer: event.performers.map((name) => ({
            "@type": "PerformingGroup" as const,
            name,
          })),
        }
      : {}),
    sameAs: event.sourceUrl,
    startDate,
    url: new URL(
      getGoingOutDetailPath(city, "montegigs", event.sourceEventId),
      siteConfig.url,
    ).toString(),
  };
}

function getGoingOutDetailBreadcrumbTrail(
  city: City,
  event: GoingOutEvent,
): GoingOutBreadcrumbStep[] {
  return [
    { href: getCityPath(city), name: city.name },
    { href: getGoingOutPath(city), name: "Izlasci" },
    {
      href: getGoingOutDetailPath(city, "montegigs", event.sourceEventId),
      name: event.title,
    },
  ].map((step) => ({ ...step, url: new URL(step.href, siteConfig.url).toString() }));
}

function createGoingOutDetailBreadcrumbStructuredData(
  city: City,
  event: GoingOutEvent,
): GoingOutDetailBreadcrumbStructuredData {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: getGoingOutDetailBreadcrumbTrail(city, event).map((step, index) => ({
      "@type": "ListItem" as const,
      item: step.url,
      name: step.name,
      position: index + 1,
    })),
  };
}

function getStructuredDataStartDate(event: GoingOutEvent) {
  if (event.startsAt && !Number.isNaN(new Date(event.startsAt).getTime())) return event.startsAt;
  return /^\d{4}-\d{2}-\d{2}$/u.test(event.startDate) &&
    !Number.isNaN(new Date(`${event.startDate}T12:00:00.000Z`).getTime())
    ? event.startDate
    : undefined;
}

function isReliablyMusicEvent(event: GoingOutEvent) {
  const type = event.eventType?.trim().toLocaleLowerCase("sr-Latn-ME");
  return type === "concert" || type === "koncert" || type === "music" || type === "muzika";
}

function serializeGoingOutStructuredData(
  value: GoingOutDetailBreadcrumbStructuredData | GoingOutDetailStructuredData,
) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export {
  createGoingOutDetailBreadcrumbStructuredData,
  createGoingOutDetailStructuredData,
  getGoingOutDetailBreadcrumbTrail,
  isReliablyMusicEvent,
  serializeGoingOutStructuredData,
  type GoingOutDetailBreadcrumbStructuredData,
  type GoingOutDetailStructuredData,
};
