import { getCityPath } from "@/shared/config/public-routes";
import { siteConfig } from "@/shared/config/site";
import type { City } from "@/shared/types/city";

const aboutPlatformContent = {
  description:
    "Saznajte kako platforma Gradom.me prikuplja i prikazuje korisne lokalne informacije o Podgorici i drugim gradovima u Crnoj Gori.",
  heading: "O platformi Gradom.me",
  sections: [
    {
      body: [
        "Gradom.me na jednom mjestu okuplja korisne lokalne informacije koje se često mijenjaju. Platforma je trenutno usmjerena na Podgoricu, a njena struktura omogućava postepeno uključivanje drugih gradova u Crnoj Gori.",
      ],
      heading: "Lokalne informacije na jednom mjestu",
    },
    {
      body: [
        "Na platformi su trenutno dostupni vremenska prognoza, obavještenja o planiranim nestancima struje i prekidima vodosnabdijevanja, letovi, željeznički polasci, bioskopske projekcije, događaji i izlasci u gradu.",
      ],
      heading: "Šta možete pronaći",
    },
    {
      body: [
        "Kada su dostupni javni i zvanični izvori, Gradom.me prikuplja njihove informacije, obrađuje ih i prikazuje u ujednačenom formatu. Gradom.me nije originalni izdavalac većine obavještenja; institucija ili organizator naveden kao izvor ostaje mjerodavan.",
        "Podaci mogu kasniti, biti nepotpuni ili privremeno nedostupni. Za važne i vremenski osjetljive informacije uvijek provjerite originalni izvor.",
      ],
      heading: "Kako platforma radi",
    },
    {
      body: [
        "Dio podataka se automatski osvježava u redovnim intervalima. Vrijeme ažuriranja pomaže vam da procijenite svježinu informacije. Kada je izvor privremeno nedostupan, platforma može prikazati posljednje uspješno preuzete podatke uz oznaku da mogu biti zastarjeli.",
        "Prazan prikaz ne znači nužno da ne postoji događaj, let, projekcija, prekid ili polazak — moguće je da izvor u tom trenutku nema dostupne podatke.",
      ],
      heading: "Svježina i dostupnost podataka",
    },
    {
      body: [
        "Gradom.me je nezavisna informativna platforma. Ako primijetite netačnu ili zastarjelu informaciju, možete nam poslati upit putem kontakt forme.",
      ],
      heading: "Nezavisnost i ispravke",
    },
  ],
} as const;

function createAboutPlatformStructuredData(city: City) {
  const canonical = new URL("/o-platformi", siteConfig.url).toString();
  const cityUrl = new URL(getCityPath(city), siteConfig.url).toString();

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
            item: cityUrl,
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
