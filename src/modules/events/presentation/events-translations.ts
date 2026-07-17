import type { EventCategory, EventStatus } from "../domain/event.ts";
import type { Locale } from "@/shared/config/locale";

const eventTranslations = {
  en: {
    all: "All",
    allEventsUnavailable: "Events are temporarily unavailable",
    allEventsUnavailableDescription:
      "Try again later. Available sources remain independent from one another.",
    applyFilters: "Apply filters",
    backToEvents: "Back to events",
    categories: {
      community: "Community",
      concert: "Concert",
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
    category: "Category",
    closeFilters: "Close filters",
    details: "Event details",
    dateAndTime: "Date and time",
    endTime: "Ends",
    eventsCount: (count: number) => `${count} ${count === 1 ? "event" : "events"}`,
    filters: "Filters",
    heading: "Events in Podgorica",
    loading: "Loading events",
    location: "Location",
    noEvents: "No events are available",
    noEventsDescription: "There are currently no cached events from the official sources.",
    noResults: "No events match these filters",
    noResultsDescription: "Try changing the search or filters.",
    officialSource: "Open official source",
    organizer: "Organiser",
    postponed: "Postponed",
    provider: "Source",
    quickFilters: {
      all: "All",
      nextSevenDays: "Next 7 days",
      thisWeekend: "This weekend",
      today: "Today",
    },
    resetFilters: "Reset",
    search: "Search events",
    searchPlaceholder: "Search by name, venue or organiser",
    sort: "Sort",
    sortOptions: {
      category: "Category",
      newestSourceUpdate: "Recently updated",
      soonest: "Soonest",
      venue: "Venue",
    },
    status: {
      cancelled: "Cancelled",
      postponed: "Postponed",
    },
    supportingText: "Verified programme information from official Podgorica sources.",
    unavailableSources:
      "Some official sources are temporarily unavailable. Available events are still shown.",
  },
  me: {
    all: "Svi",
    allEventsUnavailable: "Događaji trenutno nijesu dostupni",
    allEventsUnavailableDescription:
      "Pokušajte ponovo kasnije. Dostupni izvori funkcionišu nezavisno jedan od drugog.",
    applyFilters: "Primijeni filtere",
    backToEvents: "Nazad na događaje",
    categories: {
      community: "Zajednica",
      concert: "Koncert",
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
    category: "Kategorija",
    closeFilters: "Zatvori filtere",
    details: "Detalji događaja",
    dateAndTime: "Datum i vrijeme",
    endTime: "Završava se",
    eventsCount: (count: number) => `${count} ${count === 1 ? "događaj" : "događaja"}`,
    filters: "Filteri",
    heading: "Događaji u Podgorici",
    loading: "Učitavanje događaja",
    location: "Mjesto",
    noEvents: "Nema dostupnih događaja",
    noEventsDescription: "Trenutno nema keširanih događaja iz zvaničnih izvora.",
    noResults: "Nijedan događaj ne odgovara filterima",
    noResultsDescription: "Pokušajte promijeniti pretragu ili filtere.",
    officialSource: "Otvori zvanični izvor",
    organizer: "Organizator",
    postponed: "Odgođeno",
    provider: "Izvor",
    quickFilters: {
      all: "Svi",
      nextSevenDays: "Sljedećih 7 dana",
      thisWeekend: "Ovaj vikend",
      today: "Danas",
    },
    resetFilters: "Poništi",
    search: "Pretraži događaje",
    searchPlaceholder: "Pretražite naziv, mjesto ili organizatora",
    sort: "Poredaj",
    sortOptions: {
      category: "Kategorija",
      newestSourceUpdate: "Nedavno ažurirano",
      soonest: "Najskorije",
      venue: "Mjesto",
    },
    status: {
      cancelled: "Otkazano",
      postponed: "Odgođeno",
    },
    supportingText: "Provjereni programi iz zvaničnih podgoričkih izvora.",
    unavailableSources:
      "Neki zvanični izvori trenutno nijesu dostupni. Dostupni događaji su i dalje prikazani.",
  },
} as const;

type EventsTranslations = (typeof eventTranslations)[Locale];

function getEventsTranslations(locale: Locale): EventsTranslations {
  return eventTranslations[locale];
}

function getEventCategoryLabel(locale: Locale, category: EventCategory) {
  return eventTranslations[locale].categories[category];
}

function getEventStatusLabel(locale: Locale, status: EventStatus) {
  if (status === "cancelled" || status === "postponed") {
    return eventTranslations[locale].status[status];
  }

  return undefined;
}

export {
  getEventCategoryLabel,
  getEventsTranslations,
  getEventStatusLabel,
  type EventsTranslations,
};
