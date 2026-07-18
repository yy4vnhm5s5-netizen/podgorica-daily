import type { Locale } from "@/shared/config/locale";

const translations = {
  en: {
    dashboard: {
      cards: {
        airQuality: "Air Quality",
        eventsDescription: "There are currently no scheduled events.",
        events: "Events",
        explorePodgorica: "Explore Podgorica",
        explorePodgoricaDescription: "Places are currently unavailable.",
        importantNumbers: "Important Numbers",
        importantNumbersDescription: "Data is currently unavailable.",
      },
      advertising: {
        label: "Advertising",
        subtitle: "Want to promote your local business? Contact us.",
        title: "Your advertisement",
      },
    },
    metadata: {
      description: "A trusted, accessible guide to daily life in Podgorica.",
      title: "Podgorica Daily",
    },
    shell: {
      globalSearchComingSoon: "Global search coming soon",
      languageNames: {
        en: "English",
        me: "Montenegrin",
      },
      languageSwitcherLabel: "Language",
      mobileNavigationLabel: "Mobile navigation",
      navigation: {
        dashboard: "Dashboard",
        events: "Events",
        search: "Search",
      },
      primaryNavigationLabel: "Primary navigation",
      skipToContent: "Skip to content",
      tagline: "local information, thoughtfully designed.",
    },
  },
  me: {
    dashboard: {
      cards: {
        airQuality: "Kvalitet vazduha",
        eventsDescription: "Trenutno nema najavljenih događaja.",
        events: "Događaji",
        explorePodgorica: "Istražite Podgoricu",
        explorePodgoricaDescription: "Mjesta trenutno nijesu dostupna.",
        importantNumbers: "Važni brojevi",
        importantNumbersDescription: "Podaci trenutno nijesu dostupni.",
      },
      advertising: {
        label: "Oglašavanje",
        subtitle: "Želite da promovišete svoj lokalni biznis? Kontaktirajte nas.",
        title: "Vaša reklama",
      },
    },
    metadata: {
      description: "Pouzdan i pristupačan vodič kroz svakodnevni život u Podgorici.",
      title: "Podgorica Daily",
    },
    shell: {
      globalSearchComingSoon: "Globalna pretraga uskoro će biti dostupna",
      languageNames: {
        en: "Engleski",
        me: "Crnogorski",
      },
      languageSwitcherLabel: "Jezik",
      mobileNavigationLabel: "Mobilna navigacija",
      navigation: {
        dashboard: "Pregled",
        events: "Događaji",
        search: "Pretraga",
      },
      primaryNavigationLabel: "Glavna navigacija",
      skipToContent: "Preskoči na sadržaj",
      tagline: "lokalne informacije, pažljivo oblikovane.",
    },
  },
} as const;

type Translations = (typeof translations)[Locale];

function getTranslations(locale: Locale): Translations {
  return translations[locale];
}

export { getTranslations, type Translations };
