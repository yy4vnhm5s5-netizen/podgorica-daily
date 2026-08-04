import type { CityEvent } from "../domain/event.ts";
import { getEventSummary } from "./event-summary.ts";
import { getCity } from "@/shared/config/cities";
import { getCityPath, getEventDetailPath, getEventsPath } from "@/shared/config/public-routes";
import { siteConfig } from "@/shared/config/site";
import type { City } from "@/shared/types/city";

type EventSchemaStatus =
  | "https://schema.org/EventCancelled"
  | "https://schema.org/EventPostponed"
  | "https://schema.org/EventScheduled";

interface EventStructuredData {
  "@context": "https://schema.org";
  "@type": "Event";
  description?: string;
  endDate?: string;
  eventStatus: EventSchemaStatus;
  image?: string;
  // Required by Google, so it is non-optional here: an Event object can only be constructed once
  // a truthful Place has been established (see getEventStructuredDataEligibility).
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
  sameAs: string;
  startDate: string;
  url: string;
}

type EventStructuredDataIneligibility = "missing-city" | "missing-start-date" | "missing-location";

type EventStructuredDataEligibility =
  | { city: City; eligible: true; startDate: string; venueName: string }
  | { eligible: false; reason: EventStructuredDataIneligibility };

// Google requires `location` with both `location.name` and `location.address` for a physical
// Event. We hold no street address for any event — no collector populates `rawAddress`, so
// `CityEvent.address` is always undefined in production — which leaves two honest options per
// event: build a Place from the venue the source did name plus the city that venue verifiably
// sits in, or emit no Event markup at all.
//
// We do NOT fall back to naming the city as the venue, or the event title as the venue: both
// would be assertions the source never made. An event with no venue therefore gets no Event
// JSON-LD. Its page stays indexable, canonical and in the sitemap — only the rich-result markup
// is withheld, because incomplete Event markup is worse than none.
function getEventStructuredDataEligibility(event: CityEvent): EventStructuredDataEligibility {
  const startDate = getValidIsoDateValue(event.startsAt) ?? getValidIsoDateValue(event.startDate);
  if (!startDate) return { eligible: false, reason: "missing-start-date" };

  const venueName = event.venueName?.trim();
  if (!venueName) return { eligible: false, reason: "missing-location" };

  // The locality has to come from the registry rather than the raw cityId, and the registry is
  // Montenegro-only — so "ME" is verified, not assumed.
  const city = getCity(event.cityId);
  if (!city) return { eligible: false, reason: "missing-city" };

  return { city, eligible: true, startDate, venueName };
}

// schema.org has no "completed" state and Google defines none, so a past event that simply
// happened stays EventScheduled — it was scheduled and it was neither cancelled nor postponed.
// Only the two states a provider explicitly asserts override that.
function getEventSchemaStatus(status: CityEvent["status"]): EventSchemaStatus {
  if (status === "cancelled") return "https://schema.org/EventCancelled";
  if (status === "postponed") return "https://schema.org/EventPostponed";
  return "https://schema.org/EventScheduled";
}

// A cached event's date fields are not guaranteed to be a valid, parseable date (see
// sanitizeCachedEventDates in events-cache.ts for the primary defense at the read boundary).
// Structured data is public, machine-read JSON-LD, so a malformed value must not be embedded
// as if it were trustworthy — this degrades to omitting the field, same as when it's absent.
function getValidIsoDateValue(value: string | undefined) {
  return value !== undefined && !Number.isNaN(new Date(value).getTime()) ? value : undefined;
}

function createEventStructuredData(event: CityEvent): EventStructuredData | undefined {
  const eligibility = getEventStructuredDataEligibility(event);
  if (!eligibility.eligible) return undefined;

  const { city, startDate, venueName } = eligibility;
  // Only a genuine provider-supplied end. No duration is invented for a timed event and no
  // end-of-day is invented for a date-only one, so this stays absent for most events.
  const endDate = getValidIsoDateValue(event.endsAt);
  const summary = getEventSummary(event.description);

  return {
    "@context": "https://schema.org",
    "@type": "Event",
    ...(summary ? { description: summary } : {}),
    ...(endDate ? { endDate } : {}),
    eventStatus: getEventSchemaStatus(event.status),
    ...(event.imageUrl ? { image: event.imageUrl } : {}),
    location: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressCountry: "ME",
        addressLocality: city.name,
        // Included only if a collector ever supplies one. No street address is derived from the
        // venue name, the city, or anything else.
        ...(event.address ? { streetAddress: event.address } : {}),
      },
      // Always the venue the source named — never the event title and never the city.
      name: venueName,
    },
    name: event.title,
    // Emitted only where a provider states an organizer (Tourism Podgorica's "Organizator:").
    // Gradom.me publishes these listings, it does not host the events, so it is never claimed
    // here. `performer` and `offers` are absent by the same rule — see the module tests.
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
  getEventSchemaStatus,
  getEventStructuredDataEligibility,
  serializeStructuredData,
  type EventBreadcrumbStructuredData,
  type EventSchemaStatus,
  type EventStructuredData,
  type EventStructuredDataEligibility,
  type EventStructuredDataIneligibility,
};
