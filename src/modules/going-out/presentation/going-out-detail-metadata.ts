import type { GoingOutEvent } from "../domain/going-out-event.ts";
import {
  addCityContextToMetadataTitle,
  normalizeMetadataText,
  truncateMetadataText,
} from "@/shared/lib/metadata-text";
import { getCityName } from "@/shared/config/cities";
import { getPageTitle } from "@/shared/config/site";
import type { City } from "@/shared/types/city";

const maximumGoingOutDetailMetadataDescriptionLength = 160;
const maximumGoingOutDetailMetadataTitleLength = 75;

function createGoingOutDetailMetadataTitle({ city, event }: { city: City; event: GoingOutEvent }) {
  const currentTitle = getPageTitle(addCityContextToMetadataTitle(event.title, city));
  if (currentTitle.length <= maximumGoingOutDetailMetadataTitleLength) return currentTitle;

  const cityContext = ` — ${getCityName(city)}`;
  const brandSuffix = getPageTitle("");
  const titleBudget =
    maximumGoingOutDetailMetadataTitleLength - cityContext.length - brandSuffix.length;
  const eventTitle = normalizeMetadataText(event.title) ?? event.title.trim();

  return getPageTitle(`${truncateMetadataText(eventTitle, titleBudget)}${cityContext}`);
}

function createGoingOutDetailMetadataDescription({
  cityLocative,
  event,
  schedule,
}: {
  cityLocative: string;
  event: GoingOutEvent;
  schedule?: string;
}) {
  const title = normalizeMetadataText(event.title) ?? event.title.trim();
  const venue = normalizeMetadataText(event.venue);
  const context = `Događaj ${title}${venue ? ` u ${venue}` : ""} u ${cityLocative}${schedule ? `, ${schedule}` : ""}`;
  const prefix = context.endsWith(".") ? context : `${context}.`;
  const description = normalizeMetadataText(event.description);

  if (!description || prefix.length >= maximumGoingOutDetailMetadataDescriptionLength) {
    return truncateMetadataText(prefix, maximumGoingOutDetailMetadataDescriptionLength);
  }

  return truncateMetadataText(
    `${prefix} ${description}`,
    maximumGoingOutDetailMetadataDescriptionLength,
  );
}

export {
  createGoingOutDetailMetadataDescription,
  createGoingOutDetailMetadataTitle,
  maximumGoingOutDetailMetadataDescriptionLength,
  maximumGoingOutDetailMetadataTitleLength,
};
