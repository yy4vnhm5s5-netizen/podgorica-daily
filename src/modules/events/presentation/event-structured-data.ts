import type { CityEvent } from "../domain/event.ts";
import { getEventSummary } from "./event-summary.ts";
import { getCityPath, getEventDetailPath, getEventsPath } from "@/shared/config/public-routes";
import { siteConfig } from "@/shared/config/site";
import type { City } from "@/shared/types/city";

interface EventStructuredData {
  "@context": "https://schema.org";
  "@type": "Event";
  description?: string;
  endDate?: string;
  eventStatus?: "https://schema.org/EventCancelled" | "https://schema.org/EventPostponed";
  image?: string;
  location?: {
    "@type": "Place";
    address?: { "@type": "PostalAddress"; streetAddress: string };
    name?: string;
  };
  name: string;
  organizer?: { "@type": "Organization"; name: string };
  sameAs: string;
  startDate: string;
  url: string;
}

// A cached event's date fields are not guaranteed to be a valid, parseable date (see
// sanitizeCachedEventDates in events-cache.ts for the primary defense at the read boundary).
// Structured data is public, machine-read JSON-LD, so a malformed value must not be embedded
// as if it were trustworthy — this degrades to omitting the field, same as when it's absent.
function getValidIsoDateValue(value: string | undefined) {
  return value !== undefined && !Number.isNaN(new Date(value).getTime()) ? value : undefined;
}

function createEventStructuredData(event: CityEvent): EventStructuredData | undefined {
  const startDate = getValidIsoDateValue(event.startsAt) ?? getValidIsoDateValue(event.startDate);
  if (!startDate) return undefined;
  const endDate = getValidIsoDateValue(event.endsAt);
  const summary = getEventSummary(event.description);

  return {
    "@context": "https://schema.org",
    "@type": "Event",
    ...(summary ? { description: summary } : {}),
    ...(endDate ? { endDate } : {}),
    ...(event.status === "cancelled"
      ? { eventStatus: "https://schema.org/EventCancelled" as const }
      : {}),
    ...(event.status === "postponed"
      ? { eventStatus: "https://schema.org/EventPostponed" as const }
      : {}),
    ...(event.imageUrl ? { image: event.imageUrl } : {}),
    ...(event.venueName || event.address
      ? {
          location: {
            "@type": "Place" as const,
            ...(event.address
              ? { address: { "@type": "PostalAddress" as const, streetAddress: event.address } }
              : {}),
            ...(event.venueName ? { name: event.venueName } : {}),
          },
        }
      : {}),
    name: event.title,
    ...(event.organizer
      ? { organizer: { "@type": "Organization" as const, name: event.organizer } }
      : {}),
    sameAs: event.sourceUrl,
    startDate,
    url: new URL(getEventDetailPath(event.cityId, event.id), siteConfig.url).toString(),
  };
}

interface EventBreadcrumbStructuredData {
  "@context": "https://schema.org";
  "@type": "BreadcrumbList";
  itemListElement: Array<{ "@type": "ListItem"; item: string; name: string; position: number }>;
}

// A separate script/object from createEventStructuredData (not merged into one @graph) so the
// existing Event payload — and its exact tested shape — never changes shape for existing
// consumers; this only adds the same BreadcrumbList pattern already used on the About page,
// applied to the event detail route's own URL hierarchy (Home → City → Events → this event).
function createEventBreadcrumbStructuredData(
  city: City,
  event: CityEvent,
): EventBreadcrumbStructuredData {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", item: siteConfig.url, name: "Početna", position: 1 },
      {
        "@type": "ListItem",
        item: new URL(getCityPath(city), siteConfig.url).toString(),
        name: city.name,
        position: 2,
      },
      {
        "@type": "ListItem",
        item: new URL(getEventsPath(city), siteConfig.url).toString(),
        name: "Događaji",
        position: 3,
      },
      {
        "@type": "ListItem",
        item: new URL(getEventDetailPath(city, event.id), siteConfig.url).toString(),
        name: event.title,
        position: 4,
      },
    ],
  };
}

function serializeStructuredData(value: EventBreadcrumbStructuredData | EventStructuredData) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export {
  createEventBreadcrumbStructuredData,
  createEventStructuredData,
  serializeStructuredData,
  type EventBreadcrumbStructuredData,
  type EventStructuredData,
};
