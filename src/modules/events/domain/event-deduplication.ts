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
  const titlesMatchExactly = normalizeText(left.title) === normalizeText(right.title);
  const titlesMatchFuzzily = titlesAreHighlySimilar(left.title, right.title);
  if (!titlesMatchExactly && !titlesMatchFuzzily) return "distinct";
  if (!startTimesAreClose(left, right)) return "uncertain";

  const leftVenue = normalizeText(left.venueName ?? left.venueId ?? "");
  const rightVenue = normalizeText(right.venueName ?? right.venueId ?? "");
  if (leftVenue && rightVenue && venuesAreHighlySimilar(leftVenue, rightVenue)) return "strong";
  if (left.sourceId !== right.sourceId && titlesMatchFuzzily) return "strong";

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
    cityId: canonical.cityId,
    cityIds: [...new Set([...left.cityIds, ...right.cityIds])],
    description:
      (left.description?.length ?? 0) >= (right.description?.length ?? 0)
        ? left.description
        : right.description,
    imageUrl: selectBestImage(left, right),
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

function selectBestImage(left: CityEvent, right: CityEvent) {
  if (!left.imageUrl) return right.imageUrl;
  if (!right.imageUrl) return left.imageUrl;
  return (left.description?.length ?? 0) >= (right.description?.length ?? 0)
    ? left.imageUrl
    : right.imageUrl;
}

function sameSourceReference(left: CityEvent, right: CityEvent) {
  return (
    left.sourceId === right.sourceId &&
    left.sourceUrl === right.sourceUrl &&
    getEventStart(left) === getEventStart(right)
  );
}

function hasCityOverlap(left: CityEvent, right: CityEvent) {
  return left.cityId === right.cityId;
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
  const difference = Math.abs(
    new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime(),
  );
  return difference <= 30 * 60 * 1000;
}

function venuesAreHighlySimilar(left: string, right: string) {
  if (left === right) return true;
  return tokenSimilarity(normalizeComparisonTokens(left), normalizeComparisonTokens(right), 0.8);
}

function titlesAreHighlySimilar(left: string, right: string) {
  return tokenSimilarity(normalizeTitleTokens(left), normalizeTitleTokens(right), 0.75);
}

function normalizeTitleTokens(value: string) {
  const ignoredTokens = new Set([
    "a",
    "bend",
    "dan",
    "do",
    "duo",
    "film",
    "i",
    "iz",
    "jul",
    "jula",
    "jun",
    "juna",
    "koncert",
    "na",
    "od",
    "park",
    "parku",
    "predstava",
    "sa",
    "te",
    "u",
    "za",
  ]);
  return normalizeComparisonTokens(value).filter(
    (token) => token.length > 2 && !ignoredTokens.has(token) && !/^\d+$/.test(token),
  );
}

function normalizeComparisonTokens(value: string) {
  return normalizeText(value).split(" ").filter(Boolean);
}

function tokenSimilarity(
  left: readonly string[],
  right: readonly string[],
  minimumCoverage: number,
) {
  if (!left.length || !right.length) return false;

  const matches = left.map((leftToken) =>
    Math.max(...right.map((rightToken) => tokenSimilarityScore(leftToken, rightToken))),
  );
  const matched = matches.filter((score) => score >= 0.75).length;
  const coverage = Math.max(matched / left.length, matched / right.length);
  return matched >= Math.min(2, left.length, right.length) && coverage >= minimumCoverage;
}

function tokenSimilarityScore(left: string, right: string) {
  if (left === right) return 1;
  const distance = levenshteinDistance(left, right);
  return 1 - distance / Math.max(left.length, right.length);
}

function levenshteinDistance(left: string, right: string) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    let diagonal = previous[0];
    previous[0] = leftIndex;
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const nextDiagonal = previous[rightIndex];
      previous[rightIndex] = Math.min(
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + 1,
        diagonal + Number(left[leftIndex - 1] !== right[rightIndex - 1]),
      );
      diagonal = nextDiagonal;
    }
  }

  return previous[right.length];
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
