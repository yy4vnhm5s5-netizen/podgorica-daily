import { toZonedIso } from "../../../shared/lib/date.ts";

interface GoingOutEvent {
  city: "podgorica";
  id: string;
  imageUrl?: string;
  sourceName: "MonteGigs";
  sourceUrl: string;
  startDate: string;
  startsAt?: string;
  title: string;
  venue?: string;
}

interface GoingOutEventCandidate {
  imageUrl?: string;
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

  if (!title || !isIsoDate(startDate) || !sourceUrl) return undefined;

  const startTime = normalizeTime(candidate.startTime);
  const startsAt = startTime ? toZonedIso({ date: startDate, time: startTime }) : undefined;

  return {
    city: "podgorica",
    id: createGoingOutEventId({ sourceUrl, startDate, startTime, title }),
    ...(normalizeUrl(candidate.imageUrl) ? { imageUrl: normalizeUrl(candidate.imageUrl) } : {}),
    sourceName: "MonteGigs",
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

function normalizeUrl(value: string | undefined) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
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
  selectUpcomingGoingOutEvents,
  sortAndDeduplicateGoingOutEvents,
  type GoingOutEvent,
  type GoingOutEventCandidate,
};
