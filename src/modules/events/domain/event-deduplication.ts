import { normalizeText } from "./event-normalization.ts";
import type { CityEvent, EventSourceReference } from "./event.ts";

type EventMatchKind = "distinct" | "exact" | "strong" | "uncertain";
type EventSourceTrust =
  "aggregator" | "officialGovernment" | "officialOrganizer" | "officialVenue" | "trustedPublisher";

interface EventSourcePriority {
  priority: number;
  sourceId: string;
}

function getEventSourcePriority(trust: EventSourceTrust) {
  return {
    officialOrganizer: 10,
    officialVenue: 20,
    officialGovernment: 30,
    trustedPublisher: 50,
    aggregator: 100,
  }[trust];
}

function classifyEventMatch(left: CityEvent, right: CityEvent): EventMatchKind {
  if (left.id === right.id || sameSourceReference(left, right)) return "exact";
  if (!hasCityOverlap(left, right) || getEventCalendarDay(left) !== getEventCalendarDay(right))
    return "distinct";
  if (normalizeText(left.title) !== normalizeText(right.title)) return "distinct";

  const leftVenue = normalizeText(left.venueName ?? left.venueId ?? "");
  const rightVenue = normalizeText(right.venueName ?? right.venueId ?? "");
  if (leftVenue && rightVenue && venuesAreHighlySimilar(leftVenue, rightVenue)) return "strong";
  if (left.sourceId !== right.sourceId && startTimesAreClose(left, right)) return "strong";

  return "uncertain";
}

function deduplicateEvents(
  events: readonly CityEvent[],
  priorities: readonly EventSourcePriority[] = [],
) {
  const output: CityEvent[] = [];
  const priority = new Map(priorities.map(({ priority, sourceId }) => [sourceId, priority]));

  for (const event of events) {
    const matchIndex = output.findIndex((existing) => {
      const match = classifyEventMatch(existing, event);
      return match === "exact" || match === "strong";
    });

    if (matchIndex === -1) {
      output.push(event);
      continue;
    }

    output[matchIndex] = mergeEvents(output[matchIndex], event, priority);
  }

  return output;
}

function mergeEvents(
  left: CityEvent,
  right: CityEvent,
  priority: ReadonlyMap<string, number>,
): CityEvent {
  const canonical =
    (priority.get(left.sourceId) ?? Number.MAX_SAFE_INTEGER) <=
    (priority.get(right.sourceId) ?? Number.MAX_SAFE_INTEGER)
      ? left
      : right;
  const other = canonical === left ? right : left;
  const status = selectStatus(left.status, right.status);

  return {
    ...canonical,
    cityIds: [...new Set([...left.cityIds, ...right.cityIds])],
    description:
      (left.description?.length ?? 0) >= (right.description?.length ?? 0)
        ? left.description
        : right.description,
    imageUrl: canonical.imageUrl ?? other.imageUrl,
    organizer: canonical.organizer ?? other.organizer,
    sourceReferences: mergeSourceReferences(left.sourceReferences, right.sourceReferences),
    status,
    tags: [...new Set([...left.tags, ...right.tags])],
    venueId: canonical.venueId ?? other.venueId,
    venueName: canonical.venueName ?? other.venueName,
  };
}

function selectStatus(left: CityEvent["status"], right: CityEvent["status"]) {
  if (left === "cancelled" || right === "cancelled") return "cancelled";
  if (left === "postponed" || right === "postponed") return "postponed";
  return left;
}

function sameSourceReference(left: CityEvent, right: CityEvent) {
  return (
    left.sourceId === right.sourceId &&
    left.sourceUrl === right.sourceUrl &&
    getEventStart(left) === getEventStart(right)
  );
}

function hasCityOverlap(left: CityEvent, right: CityEvent) {
  return left.cityIds.some((cityId) => right.cityIds.includes(cityId));
}

function getEventStart(event: CityEvent) {
  return event.startsAt ?? event.startDate ?? "";
}

function getEventCalendarDay(event: CityEvent) {
  if (event.startDate) return event.startDate;
  if (!event.startsAt) return "";

  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: event.timezone,
    year: "numeric",
  }).formatToParts(new Date(event.startsAt));
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function startTimesAreClose(left: CityEvent, right: CityEvent) {
  if (!left.startsAt || !right.startsAt) return false;
  const difference = Math.abs(new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime());
  return difference <= 30 * 60 * 1000;
}

function venuesAreHighlySimilar(left: string, right: string) {
  if (left === right) return true;
  const leftTokens = new Set(left.split(" ").filter(Boolean));
  const rightTokens = new Set(right.split(" ").filter(Boolean));
  const shared = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  const total = new Set([...leftTokens, ...rightTokens]).size;
  return total > 0 && shared / total >= 0.8;
}

function mergeSourceReferences(
  left: readonly EventSourceReference[],
  right: readonly EventSourceReference[],
) {
  return [...left, ...right].filter(
    (reference, index, all) =>
      all.findIndex(
        (candidate) =>
          candidate.sourceId === reference.sourceId && candidate.sourceUrl === reference.sourceUrl,
      ) === index,
  );
}

export {
  classifyEventMatch,
  deduplicateEvents,
  getEventSourcePriority,
  type EventMatchKind,
  type EventSourcePriority,
  type EventSourceTrust,
};
