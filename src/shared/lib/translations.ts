import type { Locale } from "@/shared/config/locale";

const translations = {
  en: {
    dashboard: {
      cards: {
        airQuality: "Air Quality",
        cityAlerts: "City Alerts",
        events: "Events",
        explorePodgorica: "Explore Podgorica",
        importantNumbers: "Important Numbers",
        publicTransport: "Public Transport",
      },
      description: "A calm, accessible workspace for Podgorica's daily information.",
      emptyCardDescription: "No information is available yet.",
      title: "Dashboard",
    },
    metadata: {
      description: "A trusted, accessible guide to daily life in Podgorica.",
      title: "Podgorica Daily",
    },
    shell: {
      commandPaletteComingSoon: "Command palette coming soon",
      globalSearchComingSoon: "Global search coming soon",
      languageNames: {
        en: "English",
        me: "Montenegrin",
      },
      languageSwitcherLabel: "Language",
      mobileNavigationLabel: "Mobile navigation",
      navigation: {
        dashboard: "Dashboard",
        search: "Search",
      },
      primaryNavigationLabel: "Primary navigation",
      skipToContent: "Skip to content",
      tagline: "local information, thoughtfully designed.",
      themeSwitcherLabel: "Toggle color theme",
    },
  },
  me: {
    dashboard: {
      cards: {
        airQuality: "Kvalitet vazduha",
        cityAlerts: "Gradska upozorenja",
        events: "Događaji",
        explorePodgorica: "Istražite Podgoricu",
        importantNumbers: "Važni brojevi",
        publicTransport: "Javni prevoz",
      },
      description: "Miran i pristupačan pregled svakodnevnih informacija za Podgoricu.",
      emptyCardDescription: "Informacije još nijesu dostupne.",
      title: "Pregled",
    },
    metadata: {
      description: "Pouzdan i pristupačan vodič kroz svakodnevni život u Podgorici.",
      title: "Podgorica Daily",
    },
    shell: {
      commandPaletteComingSoon: "Paleta komandi uskoro će biti dostupna",
      globalSearchComingSoon: "Globalna pretraga uskoro će biti dostupna",
      languageNames: {
        en: "Engleski",
        me: "Crnogorski",
      },
      languageSwitcherLabel: "Jezik",
      mobileNavigationLabel: "Mobilna navigacija",
      navigation: {
        dashboard: "Pregled",
        search: "Pretraga",
      },
      primaryNavigationLabel: "Glavna navigacija",
      skipToContent: "Preskoči na sadržaj",
      tagline: "lokalne informacije, pažljivo oblikovane.",
      themeSwitcherLabel: "Promijeni temu boja",
    },
  },
} as const;

type Translations = (typeof translations)[Locale];

function getTranslations(locale: Locale): Translations {
  return translations[locale];
}

export { getTranslations, type Translations };
