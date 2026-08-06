import type { CityEvent } from "../domain/event.ts";

const maximumEventDetailMetadataDescriptionLength = 160;

interface EventDetailMetadataDescriptionInput {
  cityLocative: string;
  event: Pick<CityEvent, "description" | "title" | "venueName">;
  eventDay?: string;
}

function createEventDetailMetadataDescription({
  cityLocative,
  event,
  eventDay,
}: EventDetailMetadataDescriptionInput) {
  const title = normalizeMetadataText(event.title) ?? event.title.trim();
  const venueName = normalizeMetadataText(event.venueName);
  const context = `Događaj ${title}${venueName ? ` u ${venueName}` : ""} u ${cityLocative}${eventDay ? `, ${eventDay}` : ""}`;

  const prefix = context.endsWith(".") ? context : `${context}.`;
  const description = normalizeMetadataText(event.description);
  if (!description || prefix.length >= maximumEventDetailMetadataDescriptionLength) {
    return truncateMetadataText(prefix, maximumEventDetailMetadataDescriptionLength);
  }

  return truncateMetadataText(
    `${prefix} ${description}`,
    maximumEventDetailMetadataDescriptionLength,
  );
}

function normalizeMetadataText(value: string | undefined) {
  if (!value) return undefined;

  const normalized = value
    .replace(/<[^>]*>/gu, " ")
    .replace(/&nbsp;/giu, " ")
    .replace(/&amp;/giu, "&")
    .replace(/&quot;/giu, '"')
    .replace(/&#39;|&apos;/giu, "'")
    .replace(/\s+/gu, " ")
    .trim();

  return normalized || undefined;
}

function truncateMetadataText(value: string, maximumLength: number) {
  if (value.length <= maximumLength) return value;

  const withoutTrailingSpace = value.slice(0, maximumLength - 1).trimEnd();
  const lastWordBoundary = withoutTrailingSpace.lastIndexOf(" ");
  const shortened =
    lastWordBoundary > 0 ? withoutTrailingSpace.slice(0, lastWordBoundary) : withoutTrailingSpace;

  return `${shortened}…`;
}

export {
  createEventDetailMetadataDescription,
  maximumEventDetailMetadataDescriptionLength,
  normalizeMetadataText,
  truncateMetadataText,
  type EventDetailMetadataDescriptionInput,
};
