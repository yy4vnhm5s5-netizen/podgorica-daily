import type { CityEvent } from "../domain/event.ts";
import { getEventSummary } from "./event-summary.ts";

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
}

function createEventStructuredData(event: CityEvent): EventStructuredData | undefined {
  const startDate = event.startsAt ?? event.startDate;
  if (!startDate) return undefined;
  const summary = getEventSummary(event.description);

  return {
    "@context": "https://schema.org",
    "@type": "Event",
    ...(summary ? { description: summary } : {}),
    ...(event.endsAt ? { endDate: event.endsAt } : {}),
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
  };
}

function serializeStructuredData(value: EventStructuredData) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export { createEventStructuredData, serializeStructuredData, type EventStructuredData };
