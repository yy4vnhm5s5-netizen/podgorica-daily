import type { CityEvent, EventProviderResult } from "../domain/event.ts";
import type { CityContext } from "@/shared/types/city";
import { getCityName } from "@/shared/config/cities";

interface EventCardReadModel {
  address?: string;
  category: CityEvent["category"];
  cityName: string;
  description?: string;
  endsAt?: string;
  imageUrl?: string;
  localizedCategory: string;
  organizer?: string;
  priceLabel?: string;
  sourceLinks: Readonly<CityEvent["sourceReferences"]>;
  startsAt?: string;
  startDate?: string;
  status: CityEvent["status"];
  title: string;
  venueName?: string;
}

interface EventDataStateReadModel {
  providerStates: readonly { id: string; state: EventProviderResult["state"] }[];
  stale: boolean;
  unavailable: boolean;
}

function toEventCardReadModel(event: CityEvent, context: CityContext): EventCardReadModel {
  return {
    address: event.address,
    category: event.category,
    cityName: getCityName(context.city),
    description: event.description,
    endsAt: event.endsAt,
    imageUrl: event.imageUrl,
    localizedCategory: eventCategoryLabels[context.locale][event.category],
    organizer: event.organizer,
    priceLabel: getPriceLabel(event),
    sourceLinks: event.sourceReferences,
    startsAt: event.startsAt,
    startDate: event.startDate,
    status: event.status,
    title: event.title,
    venueName: event.venueName,
  };
}

const eventCategoryLabels = {
  en: {
    concert: "Concert",
    community: "Community",
    conference: "Conference",
    education: "Education",
    exhibition: "Exhibition",
    festival: "Festival",
    government: "Government",
    kids: "Kids",
    literature: "Literature",
    market: "Market",
    movie: "Movie",
    nightlife: "Nightlife",
    other: "Other",
    sport: "Sport",
    theatre: "Theatre",
    workshop: "Workshop",
  },
  me: {
    concert: "Koncert",
    community: "Zajednica",
    conference: "Konferencija",
    education: "Obrazovanje",
    exhibition: "Izložba",
    festival: "Festival",
    government: "Gradska uprava",
    kids: "Za djecu",
    literature: "Književnost",
    market: "Pijaca",
    movie: "Film",
    nightlife: "Noćni život",
    other: "Ostalo",
    sport: "Sport",
    theatre: "Pozorište",
    workshop: "Radionica",
  },
} as const;

function getPriceLabel(event: CityEvent) {
  if (event.isFree === true) return "free";
  if (event.priceAmount === undefined || !event.currency) return undefined;
  return `${event.priceAmount} ${event.currency}`;
}

export { toEventCardReadModel, type EventCardReadModel, type EventDataStateReadModel };
