import { siteConfig } from "@/shared/config/site";

const aboutPlatformContent = {
  description:
    "Saznajte kako Gradom.me objedinjuje lokalne informacije za Podgoricu, Budvu i Tivat — od vremena i servisnih obavještenja do događaja, izlazaka, plaža i prevoza.",
  heading: "O platformi Gradom.me",
  sections: [
    {
      body: [
        "Gradom.me okuplja javno dostupne lokalne informacije koje se često mijenjaju za Podgoricu, Budvu i Tivat, kako bi svakodnevne stvari u svakom gradu bile lakše za praćenje.",
      ],
      heading: "Lokalne informacije po gradu",
    },
    {
      body: [
        "Dostupne informacije zavise od grada. Podgorica trenutno obuhvata vrijeme, planirana isključenja struje, prekide vodosnabdijevanja, letove, željezničke polaske, bioskopski program, događaje i izlaske. Budva i Tivat obuhvataju vrijeme, planirana isključenja struje, izlaske i kvalitet mora, dok Tivat ima i događaje.",
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
