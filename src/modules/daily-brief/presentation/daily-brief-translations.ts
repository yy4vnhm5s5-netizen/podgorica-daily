import type { Locale } from "@/shared/config/locale";

interface DailyBriefTranslations {
  demo: string;
  demoNotice: string;
  emptyDescription: string;
  emptyTitle: string;
  errorDescription: string;
  errorTitle: string;
  generatedAt: string;
  greeting: {
    afternoon: string;
    morning: string;
  };
  loading: string;
  refresh: string;
  refreshUnavailable: string;
  summaries: {
    cityOverview: readonly string[];
  };
  title: string;
}

const dailyBriefTranslations: Record<Locale, DailyBriefTranslations> = {
  en: {
    demo: "Demo",
    demoNotice: "The production version will summarize verified city data from configured sources.",
    emptyDescription: "The demo brief is not available right now.",
    emptyTitle: "No daily brief available",
    errorDescription: "The demo brief could not be loaded. Please try again later.",
    errorTitle: "Daily brief unavailable",
    generatedAt: "Updated",
    greeting: {
      afternoon: "Good afternoon",
      morning: "Good morning",
    },
    loading: "Loading daily brief",
    refresh: "Refresh",
    refreshUnavailable: "Refreshing is unavailable in the demo preview",
    summaries: {
      cityOverview: [
        "This internal preview demonstrates the intended daily briefing experience.",
        "It does not summarize live city information or use an AI service.",
        "The final brief will bring verified updates from approved local sources into one clear view.",
        "Every source, freshness indicator, and limitation will remain visible alongside the summary.",
      ],
    },
    title: "AI Daily Brief",
  },
  me: {
    demo: "Demo",
    demoNotice: "Produkcijska verzija sažimaće provjerene gradske podatke iz podešenih izvora.",
    emptyDescription: "Demo pregled trenutno nije dostupan.",
    emptyTitle: "Dnevni pregled nije dostupan",
    errorDescription: "Demo pregled nije moguće učitati. Pokušajte ponovo kasnije.",
    errorTitle: "Dnevni pregled nije dostupan",
    generatedAt: "Ažurirano",
    greeting: {
      afternoon: "Dobar dan",
      morning: "Dobro jutro",
    },
    loading: "Učitavanje dnevnog pregleda",
    refresh: "Osvježi",
    refreshUnavailable: "Osvježavanje nije dostupno u demo prikazu",
    summaries: {
      cityOverview: [
        "Ovaj interni pregled prikazuje zamišljeno iskustvo dnevnog sažetka.",
        "Ne sažima aktuelne gradske informacije niti koristi AI servis.",
        "Konačna verzija objediniće provjerene novosti iz odobrenih lokalnih izvora u jasan pregled.",
        "Uz sažetak će uvijek biti vidljivi izvor, svježina podataka i njegova ograničenja.",
      ],
    },
    title: "AI pregled dana",
  },
};

function getDailyBriefTranslations(locale: Locale) {
  return dailyBriefTranslations[locale];
}

export { getDailyBriefTranslations, type DailyBriefTranslations };
