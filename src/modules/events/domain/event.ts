import type { CityContext, CityId } from "@/shared/types/city";
import type { ProviderMetadata } from "@/shared/types/provider";
import type { EventQualityDiagnostics } from "./event-quality.ts";

const eventCategories = [
  "concert",
  "festival",
  "theatre",
  "movie",
  "sport",
  "kids",
  "education",
  "conference",
  "market",
  "exhibition",
  "community",
  "government",
  "nightlife",
  "workshop",
  "literature",
  "other",
] as const;

const eventStatuses = ["scheduled", "active", "cancelled", "postponed", "completed"] as const;

type EventCategory = (typeof eventCategories)[number];
type EventStatus = (typeof eventStatuses)[number];
type EventLanguage = "en" | "me" | "und";
type EventProviderState = "disabled" | "fresh" | "mock" | "stale" | "unavailable";

interface Venue {
  address?: string;
  cityId?: CityId;
  id: string;
  latitude?: number;
  longitude?: number;
  name: string;
  sourceUrl?: string;
  website?: string;
}

interface EventSourceReference {
  sourceId: string;
  sourceName: string;
  sourceUrl: string;
}

interface CityEvent {
  address?: string;
  category: EventCategory;
  cityId: CityId;
  cityIds: CityId[];
  description?: string;
  endsAt?: string;
  firstSeenAt?: string;
  id: string;
  imageUrl?: string;
  isFree?: boolean;
  language: EventLanguage;
  organizer?: string;
  priceAmount?: number;
  recurrence?: EventRecurrence;
  sourceId: string;
  sourceName: string;
  sourceReferences: EventSourceReference[];
  sourceUpdatedAt?: string;
  sourceUrl: string;
  slug?: string;
  startDate?: string;
  startsAt?: string;
  status: EventStatus;
  tags: string[];
  timezone: string;
  title: string;
  updatedAt?: string;
  venueId?: string;
  venueName?: string;
  currency?: string;
}

interface EventCandidate {
  categoryHint?: string;
  cityHints?: string[];
  explicitStatus?: "cancelled" | "postponed" | "scheduled";
  imageUrl?: string;
  isFree?: boolean;
  language?: EventLanguage;
  organizer?: string;
  parserWarnings: string[];
  rawDateText?: string;
  rawAddress?: string;
  rawDescription?: string;
  rawPriceText?: string;
  rawTimeText?: string;
  rawTitle: string;
  rawVenue?: string;
  priceAmount?: number;
  currency?: string;
  source: EventSourceReference;
  sourceUpdatedAt?: string;
  startsAt?: string;
  startDate?: string;
  tags?: string[];
  endsAt?: string;
  timezone: string;
}

interface EventRecurrence {
  customText?: string;
  frequency: "custom" | "daily" | "oneTime" | "weekly";
  until?: string;
  weekdays?: number[];
}

interface EventProviderResult {
  events: readonly CityEvent[];
  fetchedAt?: string;
  lastRefreshError?: string;
  parserWarnings: readonly string[];
  qualityDiagnostics?: Partial<EventQualityDiagnostics>;
  sourceUpdatedAt?: string;
  state: EventProviderState;
  venues: readonly Venue[];
}

interface EventProvider {
  getCachedEvents(context: CityContext): Promise<EventProviderResult>;
  metadata: ProviderMetadata;
}

function normalizeEventCategory(value: string | undefined): EventCategory {
  const normalized = value?.trim().toLocaleLowerCase("en-US");
  return eventCategories.includes(normalized as EventCategory)
    ? (normalized as EventCategory)
    : "other";
}

function isEventStatus(value: string): value is EventStatus {
  return eventStatuses.includes(value as EventStatus);
}

function isValidCityEvent(event: CityEvent) {
  return (
    event.id.length > 0 &&
    event.title.trim().length > 0 &&
    Boolean(event.cityId) &&
    event.cityIds.length > 0 &&
    event.sourceUrl.length > 0 &&
    (isIsoTimestamp(event.startsAt) || isIsoDate(event.startDate)) &&
    isEventStatus(event.status)
  );
}

function isIsoTimestamp(value: string | undefined) {
  return (
    typeof value === "string" && !Number.isNaN(new Date(value).getTime()) && value.includes("T")
  );
}

function isIsoDate(value: string | undefined) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

export {
  eventCategories,
  eventStatuses,
  isEventStatus,
  isIsoDate,
  isIsoTimestamp,
  isValidCityEvent,
  normalizeEventCategory,
  type CityEvent,
  type EventCandidate,
  type EventCategory,
  type EventLanguage,
  type EventProvider,
  type EventProviderResult,
  type EventProviderState,
  type EventRecurrence,
  type EventSourceReference,
  type EventStatus,
  type Venue,
};
