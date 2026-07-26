import { siteConfig } from "@/shared/config/site";

const aboutPlatformContent = {
  description:
    "Saznajte kako Gradom.me prikazuje lokalne informacije za Podgoricu — od vremenske prognoze, događaja i bioskopa do letova i gradskih obavještenja.",
  heading: "O platformi Gradom.me",
  sections: [
    {
      body: [
        "Gradom.me okuplja javno dostupne lokalne informacije koje se često mijenjaju, kako bi svakodnevne stvari u Podgorici bile lakše za praćenje. Platforma je trenutno usmjerena na Podgoricu, a njena struktura omogućava postepeno uključivanje drugih gradova u Crnoj Gori.",
      ],
      heading: "Lokalne informacije za Podgoricu",
    },
    {
      body: [
        "Na Gradom.me možete pratiti vremensku prognozu za Podgoricu, planirane nestanke struje i prekide vodosnabdijevanja, letove, željezničke polaske, bioskopske projekcije, događaje i izlaske u gradu.",
      ],
      heading: "Šta možete pronaći",
    },
    {
      body: [
        "Kada su dostupni javni i zvanični izvori, Gradom.me njihove informacije obrađuje i prikazuje u ujednačenom formatu. Gradom.me nije originalni izdavalac većine obavještenja; institucija ili organizator naveden kao izvor ostaje mjerodavan.",
        "Podaci mogu kasniti, biti nepotpuni ili privremeno nedostupni. Za važne i vremenski osjetljive informacije provjerite originalni izvor.",
      ],
      heading: "Kako platforma radi",
    },
    {
      body: [
        "Dio podataka se automatski osvježava u redovnim intervalima. Prikazano vrijeme ažuriranja pomaže vam da procijenite svježinu informacije. Kada je izvor privremeno nedostupan, platforma može prikazati posljednje uspješno preuzete podatke uz oznaku da mogu biti zastarjeli.",
        "Prazan prikaz ne znači nužno da nema događaja, leta, projekcije, prekida ili polaska — moguće je da izvor u tom trenutku nema dostupne podatke.",
      ],
      heading: "Svježina i dostupnost podataka",
    },
    {
      body: [
        "Gradom.me je nezavisna informativna platforma. Ako primijetite netačnu ili zastarjelu informaciju, pošaljite nam upit putem kontakt forme.",
      ],
      heading: "Nezavisnost i ispravke",
    },
  ],
} as const;

function createAboutPlatformStructuredData() {
  const canonical = new URL("/o-platformi", siteConfig.url).toString();

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "AboutPage",
        description: aboutPlatformContent.description,
        name: aboutPlatformContent.heading,
        url: canonical,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            item: siteConfig.url,
            name: "Početna",
            position: 1,
          },
          {
            "@type": "ListItem",
            item: canonical,
            name: aboutPlatformContent.heading,
            position: 2,
          },
        ],
      },
    ],
  };
}

export { aboutPlatformContent, createAboutPlatformStructuredData };
