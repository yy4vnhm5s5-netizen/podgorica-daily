import { toZonedIso } from "../../../shared/lib/date.ts";
import type { CityId } from "@/shared/types/city";

interface GoingOutEvent {
  address?: string;
  city: CityId;
  description?: string;
  eventType?: string;
  genre?: string;
  id: string;
  imageUrl?: string;
  informationUrl?: string;
  isFree?: boolean;
  organizer?: string;
  performers?: readonly string[];
  priceLabel?: string;
  sourceName: "MonteGigs";
  sourceEventId: string;
  sourceUrl: string;
  startDate: string;
  startsAt?: string;
  title: string;
  venue?: string;
}

interface GoingOutEventCandidate {
  address?: string;
  city: CityId;
  description?: string;
  eventType?: string;
  genre?: string;
  imageUrl?: string;
  informationUrl?: string;
  isFree?: boolean;
  organizer?: string;
  performers?: readonly string[];
  priceLabel?: string;
  sourceEventId?: string;
  sourceUrl: string;
  startDate: string;
  startTime?: string;
  title: string;
  venue?: string;
}

function normalizeGoingOutEvent(candidate: GoingOutEventCandidate): GoingOutEvent | undefined {
  const title = normalizeText(candidate.title);
  const startDate = candidate.startDate.trim();
  const sourceUrl = normalizeUrl(candidate.sourceUrl);
  const sourceEventId = sourceEventIdFromSourceUrl(sourceUrl);
  const suppliedSourceEventId = normalizeSourceEventId(candidate.sourceEventId);

  if (
    !title ||
    !isIsoDate(startDate) ||
    !sourceUrl ||
    !sourceEventId ||
    (suppliedSourceEventId !== undefined && suppliedSourceEventId !== sourceEventId)
  ) {
    return undefined;
  }

  const startTime = normalizeTime(candidate.startTime);
  const startsAt = startTime ? toZonedIso({ date: startDate, time: startTime }) : undefined;
  const performers = normalizePerformers(candidate.performers);
  const address = normalizeOptionalText(candidate.address);
  const description = normalizeDescription(candidate.description);
  const eventType = normalizeOptionalText(candidate.eventType);
  const genre = normalizeOptionalText(candidate.genre);
  const informationUrl = normalizeInformationUrl(candidate.informationUrl, sourceUrl);
  const isFree = candidate.isFree === true ? true : undefined;
  const organizer = normalizeOptionalText(candidate.organizer);
  const priceLabel = isFree ? undefined : normalizeOptionalText(candidate.priceLabel);

  return {
    ...(address ? { address } : {}),
    city: candidate.city,
    ...(description ? { description } : {}),
    ...(eventType ? { eventType } : {}),
    ...(genre ? { genre } : {}),
    id: createGoingOutEventId({ sourceUrl, startDate, startTime, title }),
    ...(normalizeUrl(candidate.imageUrl) ? { imageUrl: normalizeUrl(candidate.imageUrl) } : {}),
    ...(informationUrl ? { informationUrl } : {}),
    ...(isFree ? { isFree } : {}),
    ...(organizer ? { organizer } : {}),
    ...(performers ? { performers } : {}),
    ...(priceLabel ? { priceLabel } : {}),
    sourceName: "MonteGigs",
    sourceEventId,
    sourceUrl,
    startDate,
    ...(startsAt ? { startsAt } : {}),
    title,
    ...(normalizeText(candidate.venue ?? "")
      ? { venue: normalizeText(candidate.venue ?? "") }
      : {}),
  };
}

function selectUpcomingGoingOutEvents(
  events: readonly GoingOutEvent[],
  now = new Date(),
  limit?: number,
) {
  const today = getLocalIsoDate(now);
  const upcoming = sortAndDeduplicateGoingOutEvents(events).filter(
    (event) => event.startDate >= today,
  );
  return limit === undefined ? upcoming : upcoming.slice(0, limit);
}

function sortAndDeduplicateGoingOutEvents(events: readonly GoingOutEvent[]) {
  return [
    ...new Map(
      events
        .slice()
        .sort((left, right) => {
          const dateOrder = left.startDate.localeCompare(right.startDate);
          if (dateOrder !== 0) return dateOrder;
          return (
            (left.startsAt ?? "").localeCompare(right.startsAt ?? "") ||
            left.title.localeCompare(right.title)
          );
        })
        .map((event) => [event.id, event]),
    ).values(),
  ];
}

function createGoingOutEventId({
  sourceUrl,
  startDate,
  startTime,
  title,
}: Pick<GoingOutEventCandidate, "sourceUrl" | "startDate" | "startTime" | "title">) {
  return [
    sourceUrl,
    startDate,
    startTime ?? "",
    normalizeText(title).toLocaleLowerCase("sr-Latn-ME"),
  ].join("|");
}

function getLocalIsoDate(value: Date, timeZone = "Europe/Podgorica") {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  }).formatToParts(value);
  const byType = Object.fromEntries(parts.map(({ type, value: partValue }) => [type, partValue]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00Z`));
}

function normalizeText(value: string) {
  return decodeHtml(value)
    .replace(/\s+/g, " ")
    .replace(/^[-–—\s]+|[-–—\s]+$/g, "")
    .trim();
}

function normalizeTime(value: string | undefined) {
  const match = value?.trim().match(/^(\d{1,2})[:.](\d{2})$/);
  if (!match) return undefined;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return undefined;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function normalizeSourceEventId(value: string | undefined) {
  const normalized = value?.trim();
  return normalized && /^\d+$/u.test(normalized) ? normalized : undefined;
}

function sourceEventIdFromSourceUrl(sourceUrl: string | undefined) {
  return normalizeSourceEventId(/\/(\d+)-\d{8}-/u.exec(sourceUrl ?? "")?.[1]);
}

function normalizeOptionalText(value: string | undefined) {
  const normalized = normalizeText(value ?? "");
  return normalized || undefined;
}

// A provider description is optional source material, not a UI excerpt. Reject an unexpectedly
// large value instead of silently storing a truncated account of an event.
const maximumGoingOutDescriptionLength = 4_000;

function normalizeDescription(value: string | undefined) {
  const normalized = normalizeOptionalText(value);
  return normalized && normalized.length <= maximumGoingOutDescriptionLength
    ? normalized
    : undefined;
}

function normalizePerformers(value: readonly string[] | undefined) {
  if (!value) return undefined;

  const seen = new Set<string>();
  const performers = value.flatMap((performer) => {
    const normalized = normalizeOptionalText(performer);
    if (!normalized) return [];

    const key = normalized.toLocaleLowerCase("sr-Latn-ME");
    if (seen.has(key)) return [];
    seen.add(key);
    return [normalized];
  });

  return performers.length > 0 ? performers : undefined;
}

function normalizeUrl(value: string | undefined) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function normalizeInformationUrl(value: string | undefined, sourceUrl: string) {
  const normalized = normalizeUrl(value);
  if (!normalized || normalized === sourceUrl) return undefined;

  const url = new URL(normalized);
  return url.hostname === "staging.montegigs.me" ? undefined : normalized;
}

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)));
}

export {
  createGoingOutEventId,
  getLocalIsoDate,
  normalizeGoingOutEvent,
  maximumGoingOutDescriptionLength,
  selectUpcomingGoingOutEvents,
  sortAndDeduplicateGoingOutEvents,
  type GoingOutEvent,
  type GoingOutEventCandidate,
};
