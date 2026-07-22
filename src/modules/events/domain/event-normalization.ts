import { createHash } from "node:crypto";

import { getEventStatus } from "./event-time.ts";
import {
  isIsoDate,
  isIsoTimestamp,
  normalizeEventCategory,
  type CityEvent,
  type EventCandidate,
  type EventCategory,
} from "./event.ts";
import type { CityContext } from "@/shared/types/city";

type EventNormalizationRejectionReason = "invalid-date" | "missing-date" | "missing-title";

interface EventNormalizationResult {
  event: CityEvent | null;
  parserWarnings: string[];
  rejectionReasons: EventNormalizationRejectionReason[];
}

function normalizeEventCandidate(
  candidate: EventCandidate,
  context: CityContext,
  now = new Date(),
): EventNormalizationResult {
  const warnings = [...candidate.parserWarnings];
  const title = normalizeEventTitle(candidate.rawTitle);
  const description = normalizeEventDisplayText(candidate.rawDescription);
  const venueName = normalizeEventDisplayText(candidate.rawVenue);
  const address = normalizeEventDisplayText(candidate.rawAddress);
  const organizer = normalizeEventDisplayText(candidate.organizer);

  if (!title) {
    return {
      event: null,
      parserWarnings: [...warnings, "Missing event title."],
      rejectionReasons: ["missing-title"],
    };
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
      rejectionReasons: [
        candidate.startsAt || candidate.startDate ? "invalid-date" : "missing-date",
      ],
    };
  }

  const event: CityEvent = {
    address,
    category: resolveEventCategory(candidate.categoryHint, `${title} ${description ?? ""}`),
    cityId: context.city.id,
    cityIds: [context.city.id],
    description,
    currency: candidate.currency,
    endsAt,
    id: createEventId({
      cityId: context.city.id,
      sourceId: candidate.source.sourceId,
      startsAt: startsAt ?? startDate,
      title,
      venue: venueName,
    }),
    imageUrl: candidate.imageUrl,
    isFree: candidate.isFree,
    language: candidate.language ?? "und",
    organizer,
    priceAmount: candidate.priceAmount,
    sourceId: candidate.source.sourceId,
    sourceName: candidate.source.sourceName,
    sourceReferences: [candidate.source],
    sourceUpdatedAt: candidate.sourceUpdatedAt,
    sourceUrl: candidate.source.sourceUrl,
    slug: createEventSlug(title),
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
    tags: candidate.tags ?? [],
    timezone: candidate.timezone,
    title,
    venueName,
  };

  return { event, parserWarnings: warnings, rejectionReasons: [] };
}

function decodeHtmlEntities(value: string) {
  const namedEntities: Record<string, string> = {
    amp: "&",
    apos: "'",
    hellip: "…",
    mdash: "—",
    nbsp: " ",
    ndash: "–",
    quot: '"',
  };

  return value.replace(
    /&(?:#(\d+)|#x([\da-f]+)|([a-z]+));/gi,
    (entity, decimal, hexadecimal, named) => {
      if (named) return namedEntities[named.toLocaleLowerCase("en-US")] ?? entity;
      const codePoint = Number.parseInt(decimal ?? hexadecimal, hexadecimal ? 16 : 10);
      return Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : entity;
    },
  );
}

function normalizeEventDisplayText(value: string | undefined) {
  if (!value) return undefined;
  const normalized = decodeHtmlEntities(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/\b8211\b/g, "–")
    .replace(/\s+/g, " ")
    .trim();
  return normalized || undefined;
}

function normalizeEventTitle(value: string) {
  const display = normalizeEventDisplayText(value);
  if (!display) return "";

  const cleaned = display
    .replace(emojiPattern, " ")
    .replace(/[\u200d\ufe0e\ufe0f]/g, "")
    .replace(/(?:\s*[-–—]\s*){2,}/g, " – ")
    .replace(/\s*([–—])\s*/g, " $1 ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/^[\s,;:!?.–—-]+|[\s,;:!?.–—-]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned === cleaned.toLocaleLowerCase("me-ME") ? toTitleCase(cleaned) : cleaned;
}

const emojiPattern =
  /\p{Extended_Pictographic}(?:\p{Emoji_Modifier}|\uFE0E|\uFE0F|\u200D\p{Extended_Pictographic})*/gu;

function toTitleCase(value: string) {
  const lowercaseWords = new Set([
    "duo",
    "i",
    "ili",
    "iz",
    "ka",
    "kao",
    "na",
    "nad",
    "od",
    "po",
    "pri",
    "sa",
    "te",
    "u",
    "za",
  ]);
  let hasWord = false;

  return value.replace(/\p{L}[\p{L}\p{M}'’-]*/gu, (word) => {
    const normalized = word.toLocaleLowerCase("me-ME");
    const shouldPreserveLowercase = hasWord && lowercaseWords.has(normalized);
    hasWord = true;
    return shouldPreserveLowercase
      ? normalized
      : `${normalized.slice(0, 1).toLocaleUpperCase("me-ME")}${normalized.slice(1)}`;
  });
}

function resolveEventCategory(categoryHint: string | undefined, text: string): EventCategory {
  const providerCategory = normalizeEventCategory(categoryHint);
  const inferredCategory = inferEventCategory(text);
  return inferredCategory === "kids" || providerCategory === "other"
    ? inferredCategory
    : providerCategory;
}

function inferEventCategory(value: string): EventCategory {
  const normalized = normalizeText(value);
  if (/djeca|djecji|djecja|omladin/.test(normalized)) return "kids";
  if (/izlozb|galerij/.test(normalized)) return "exhibition";
  if (/koncert|muzik|dzez|jazz|bend|orkestar|hor|opera/.test(normalized)) return "concert";
  if (/festival/.test(normalized)) return "festival";
  if (/predstav|pozorist|teatar|drama|balet/.test(normalized)) return "theatre";
  if (/film|projekcij|kino|bioskop/.test(normalized)) return "movie";
  if (/radionic|kurs|obuka/.test(normalized)) return "workshop";
  if (/predavanje|tribina|panel|diskusij/.test(normalized)) return "education";
  if (/konferenc|simpozij|kongres/.test(normalized)) return "conference";
  if (/sport|utakmic|turnir|maraton|trka/.test(normalized)) return "sport";
  if (/bazar|pijac|sajam/.test(normalized)) return "market";
  if (/zajednic|humanitar|druzenj|susret/.test(normalized)) return "community";
  return "other";
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

function createEventSlug(title: string) {
  const slug = normalizeText(title).replace(/\s+/g, "-");
  return slug || undefined;
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

export {
  createEventId,
  createEventSlug,
  decodeHtmlEntities,
  inferEventCategory,
  normalizeEventCandidate,
  normalizeEventDisplayText,
  normalizeEventTitle,
  normalizeText,
  type EventNormalizationRejectionReason,
  type EventNormalizationResult,
};
