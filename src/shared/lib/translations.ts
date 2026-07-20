import type { Locale } from "@/shared/config/locale";

const translations = {
  en: {
    dashboard: {
      cards: {
        airQuality: "Air Quality",
        explorePodgorica: "Explore Podgorica",
        explorePodgoricaDescription: "Places are currently unavailable.",
        importantNumbers: "Important Numbers",
        importantNumbersDescription: "Data is currently unavailable.",
      },
      emergencyNumbers: {
        ambulance: "Ambulance",
        fireService: "Fire service",
        label: "Emergency numbers",
        police: "Police",
      },
      advertising: {
        subtitle: "Contact us →",
        title: "Your ad could be here",
      },
    },
    metadata: {
      description: "A trusted, accessible guide to daily life in Podgorica.",
      title: "Gradom",
    },
    shell: {
      languageNames: {
        en: "English",
        me: "Montenegrin",
      },
      languageSwitcherLabel: "Language",
      mobileNavigationLabel: "Mobile navigation",
      navigation: {
        contact: "Contact",
        dashboard: "Dashboard",
        events: "Events",
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
        explorePodgorica: "Istražite Podgoricu",
        explorePodgoricaDescription: "Mjesta trenutno nijesu dostupna.",
        importantNumbers: "Važni brojevi",
        importantNumbersDescription: "Podaci trenutno nijesu dostupni.",
      },
      emergencyNumbers: {
        ambulance: "Hitna",
        fireService: "Vatrogasci",
        label: "Hitni brojevi",
        police: "Policija",
      },
      advertising: {
        subtitle: "Kontaktirajte nas →",
        title: "Vaša reklama može biti ovdje",
      },
    },
    metadata: {
      description: "Pouzdan i pristupačan vodič kroz svakodnevni život u Podgorici.",
      title: "Gradom",
    },
    shell: {
      languageNames: {
        en: "Engleski",
        me: "Crnogorski",
      },
      languageSwitcherLabel: "Jezik",
      mobileNavigationLabel: "Mobilna navigacija",
      navigation: {
        contact: "Kontakt",
        dashboard: "Pregled",
        events: "Događaji",
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
