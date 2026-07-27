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
  };
}

function serializeStructuredData(value: EventStructuredData) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export { createEventStructuredData, serializeStructuredData, type EventStructuredData };
