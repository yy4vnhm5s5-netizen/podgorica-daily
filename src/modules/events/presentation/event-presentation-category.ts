import type { EventCategory } from "../domain/event.ts";

const eventPresentationCategories = [
  "music",
  "theatre",
  "film",
  "exhibition",
  "children",
  "education",
  "sport",
  "community",
  "other",
] as const;

type EventPresentationCategory = (typeof eventPresentationCategories)[number];

const categoryMap: Record<EventCategory, EventPresentationCategory> = {
  community: "community",
  concert: "music",
  conference: "education",
  education: "education",
  exhibition: "exhibition",
  festival: "music",
  government: "community",
  kids: "children",
  literature: "education",
  market: "community",
  movie: "film",
  nightlife: "music",
  other: "other",
  sport: "sport",
  theatre: "theatre",
  workshop: "education",
};

function getEventPresentationCategory(category: EventCategory) {
  return categoryMap[category];
}

function getDomainCategories(category: EventPresentationCategory) {
  return eventCategories.filter(
    (domainCategory) => getEventPresentationCategory(domainCategory) === category,
  );
}

function isEventPresentationCategory(value: unknown): value is EventPresentationCategory {
  return (
    typeof value === "string" &&
    eventPresentationCategories.includes(value as EventPresentationCategory)
  );
}

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
] as const satisfies readonly EventCategory[];

export {
  eventPresentationCategories,
  getDomainCategories,
  getEventPresentationCategory,
  isEventPresentationCategory,
  type EventPresentationCategory,
};
