import type { CityEvent } from "../domain/event.ts";
import { getEventDetailPageTitle } from "./events-ui-model.ts";
import { getCityName } from "@/shared/config/cities";
import { getPageTitle } from "@/shared/config/site";
import { normalizeMetadataText, truncateMetadataText } from "@/shared/lib/metadata-text";
import type { City } from "@/shared/types/city";

const maximumEventDetailMetadataDescriptionLength = 160;
const maximumEventDetailMetadataTitleLength = 75;

interface EventDetailMetadataDescriptionInput {
  cityLocative: string;
  event: Pick<CityEvent, "description" | "title" | "venueName">;
  eventDay?: string;
}

interface EventDetailMetadataTitleInput {
  city: City;
  event: CityEvent;
}

function createEventDetailMetadataTitle({ city, event }: EventDetailMetadataTitleInput) {
  const currentTitle = getPageTitle(getEventDetailPageTitle(event, city));
  if (currentTitle.length <= maximumEventDetailMetadataTitleLength) return currentTitle;

  // The full raw title remains in the page and Event JSON-LD. Only the metadata title is bounded;
  // once shortening is necessary, city context is explicitly retained even if the raw title had
  // happened to mention the city after the shortened portion.
  const cityContext = ` — ${getCityName(city)}`;
  const brandSuffix = getPageTitle("");
  const titleBudget =
    maximumEventDetailMetadataTitleLength - cityContext.length - brandSuffix.length;
  const eventTitle = normalizeMetadataText(event.title) ?? event.title.trim();

  return getPageTitle(`${truncateMetadataText(eventTitle, titleBudget)}${cityContext}`);
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

export {
  createEventDetailMetadataTitle,
  createEventDetailMetadataDescription,
  maximumEventDetailMetadataDescriptionLength,
  maximumEventDetailMetadataTitleLength,
  normalizeMetadataText,
  truncateMetadataText,
  type EventDetailMetadataDescriptionInput,
};
