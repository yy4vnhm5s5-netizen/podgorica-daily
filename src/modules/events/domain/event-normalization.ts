import { createHash } from "node:crypto";

import { getEventStatus } from "./event-time.ts";
import {
  isIsoDate,
  isIsoTimestamp,
  normalizeEventCategory,
  type CityEvent,
  type EventCandidate,
} from "./event.ts";
import type { CityContext } from "@/shared/types/city";

function normalizeEventCandidate(
  candidate: EventCandidate,
  context: CityContext,
  now = new Date(),
) {
  const warnings = [...candidate.parserWarnings];
  const title = normalizeText(candidate.rawTitle);

  if (!title) {
    return { event: null, parserWarnings: [...warnings, "Missing event title."] };
  }

  const startsAt = isIsoTimestamp(candidate.startsAt) ? candidate.startsAt : undefined;
  const startDate = isIsoDate(candidate.startDate) ? candidate.startDate : undefined;
  const endsAt = isIsoTimestamp(candidate.endsAt) ? candidate.endsAt : undefined;
  if ((candidate.startsAt && !startsAt) || (candidate.startDate && !startDate)) {
    warnings.push("Event date or time was not confidently parsed.");
  }
  if (candidate.endsAt && !endsAt) warnings.push("Event end time was not confidently parsed.");

  if (!startsAt && !startDate) {
    return {
      event: null,
      parserWarnings: [...warnings, "Missing a confidently parsed event date."],
    };
  }

  const event: CityEvent = {
    category: normalizeEventCategory(candidate.categoryHint),
    cityIds: [context.city.id],
    description: candidate.rawDescription?.trim() || undefined,
    currency: candidate.currency,
    endsAt,
    id: createEventId({
      cityId: context.city.id,
      sourceId: candidate.source.sourceId,
      startsAt: startsAt ?? startDate,
      title,
      venue: candidate.rawVenue,
    }),
    imageUrl: candidate.imageUrl,
    isFree: candidate.isFree,
    language: candidate.language ?? "und",
    organizer: candidate.organizer,
    priceAmount: candidate.priceAmount,
    sourceId: candidate.source.sourceId,
    sourceName: candidate.source.sourceName,
    sourceReferences: [candidate.source],
    sourceUpdatedAt: candidate.sourceUpdatedAt,
    sourceUrl: candidate.source.sourceUrl,
    startDate,
    startsAt,
    status: getEventStatus(
      {
        endsAt,
        explicitStatus: candidate.explicitStatus,
        startDate,
        startsAt,
      },
      now,
    ),
    tags: [],
    timezone: candidate.timezone,
    title,
    venueName: candidate.rawVenue?.trim() || undefined,
  };

  return { event, parserWarnings: warnings };
}

function createEventId(input: {
  cityId: string;
  sourceId: string;
  startsAt: string | undefined;
  title: string;
  venue?: string;
}) {
  const identity = [
    input.sourceId,
    input.cityId,
    normalizeText(input.title),
    input.startsAt ?? "date-unknown",
    normalizeText(input.venue ?? "venue-unknown"),
  ].join("|");
  return `event_${createHash("sha256").update(identity).digest("hex").slice(0, 20)}`;
}

function normalizeText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export { createEventId, normalizeEventCandidate, normalizeText };
