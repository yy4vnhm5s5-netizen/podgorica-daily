import { DashboardLayout } from "@/shared/components/layout/dashboard-layout";
import { Card, CardContent } from "@/shared/components/ui/card";
import { getContactPath } from "@/shared/config/public-routes";
import { getTranslations } from "@/shared/lib/translations";
import type { City } from "@/shared/types/city";

type LegalDocument = "privacy" | "terms";

const legalDocuments = {
  privacy: {
    description:
      "Ova politika objašnjava kako Gradom.me obrađuje podatke posjetilaca i upite poslate putem kontakt forme.",
    sections: [
      {
        body: [
          "Gradom.me prikuplja samo podatke potrebne za rad sajta, bezbjednost i odgovor na upite. Trenutno ne prodajemo lične podatke.",
        ],
        heading: "Podaci koje prikupljamo",
      },
      {
        body: [
          "Kada pošaljete upit, obrađujemo ime i prezime, e-mail adresu, poruku, kao i opcione podatke koje unesete, poput kompanije i telefona. Te podatke koristimo isključivo da odgovorimo na vaš upit i vodimo neophodnu poslovnu komunikaciju.",
        ],
        heading: "Kontakt forma",
      },
      {
        body: [
          "Naši serveri mogu automatski evidentirati IP adresu, podatke o pregledaču, uređaju, vremenu zahtjeva i tehničke zapise potrebne za sigurnost, otkrivanje zloupotreba i pouzdan rad usluge.",
        ],
        heading: "Serverski zapisi i bezbjednost",
      },
      {
        body: [
          "Podatke čuvamo samo onoliko dugo koliko je potrebno za navedene svrhe, zakonske obaveze ili rješavanje sporova. Podaci iz kontakt forme se ne dijele sa trećim stranama, osim kada je to zakonom obavezno.",
        ],
        heading: "Čuvanje i dijeljenje podataka",
      },
      {
        body: [
          "Gradom.me trenutno koristi samo tehnički neophodne kolačiće, ako su potrebni za rad usluge. Ne prikazujemo baner za saglasnost jer ne koristimo analitičke ili marketinške kolačiće. Ako takve kolačiće uvedemo u budućnosti, ovu politiku ćemo ažurirati prije njihove upotrebe.",
        ],
        heading: "Kolačići",
      },
      {
        body: [
          "Možete tražiti pristup, ispravku ili brisanje svojih podataka, kao i informacije o njihovoj obradi, u skladu sa primjenjivim propisima. Sajt može sadržati linkove ka stranicama trećih strana; njihove politike privatnosti uređuju njihove vlasnike.",
        ],
        heading: "Vaša prava i linkovi trećih strana",
      },
    ],
    title: "Politika privatnosti",
  },
  terms: {
    description:
      "Ovi uslovi uređuju korišćenje javno dostupnih sadržaja i usluga na sajtu Gradom.me.",
    sections: [
      {
        body: [
          "Gradom.me je javni informativni servis za svakodnevni život u gradu. Sadržaj može uključivati podatke iz zvaničnih javnih izvora, sa jasno naznačenim izvorom i vremenom ažuriranja kada je to relevantno.",
        ],
        heading: "O servisu i javnim izvorima",
      },
      {
        body: [
          "Nastojimo da informacije budu tačne i ažurne, ali ne garantujemo njihovu potpunost, neprekidnu dostupnost niti pogodnost za pojedinačnu namjenu. Za odluke koje mogu imati pravne, finansijske, zdravstvene ili bezbjednosne posljedice provjerite informacije kod zvaničnog izvora.",
        ],
        heading: "Tačnost informacija i ograničenje odgovornosti",
      },
      {
        body: [
          "Sajt smijete koristiti zakonito, razumno i za lične ili interne informativne potrebe. Nije dozvoljeno ometati rad sajta, zaobilaziti tehničke mjere zaštite, predstavljati se kao Gradom.me ili koristiti sadržaj na način koji šteti servisu, korisnicima ili izvorima podataka.",
        ],
        heading: "Dozvoljeno i zabranjeno korišćenje",
      },
      {
        body: [
          "Bez prethodne pisane dozvole nije dozvoljeno HTML, JSON ili API scraping, automatizovano indeksiranje ili crawling, masovno preuzimanje, kopiranje baza podataka, prikupljanje sadržaja za obuku AI sistema ili AI botova, izgradnja konkurentskih servisa na osnovu sadržaja Gradom.me, niti zaobilaženje tehničkih zaštita.",
        ],
        heading: "Automatizovano prikupljanje sadržaja",
      },
      {
        body: [
          "Raspored, dizajn, softver, organizacija informacija i originalni sadržaj Gradom.me pripadaju Gradom.me ili odgovarajućim nosiocima prava. Linkovi ka stranicama trećih strana služe radi informisanja; ne kontrolišemo njihov sadržaj, dostupnost ni politike.",
        ],
        heading: "Intelektualna svojina i linkovi trećih strana",
      },
      {
        body: [
          "Usluga može biti privremeno izmijenjena, ograničena ili nedostupna zbog održavanja, izvora podataka ili drugih okolnosti. Ove uslove možemo izmijeniti objavljivanjem nove verzije na ovoj stranici.",
        ],
        heading: "Dostupnost usluge i izmjene uslova",
      },
    ],
    title: "Uslovi korišćenja",
  },
} as const;

function LegalPage({ city, document }: { city: City; document: LegalDocument }) {
  const content = legalDocuments[document];
  const translations = getTranslations("me");

  return (
    <DashboardLayout city={city} translations={translations}>
      <article aria-labelledby="legal-heading" className="mx-auto max-w-3xl space-y-8">
        <header className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl" id="legal-heading">
            {content.title}
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
            {content.description}
          </p>
        </header>
        <Card className="border-primary/15">
          <CardContent className="space-y-8 p-5 sm:p-7">
            {content.sections.map((section) => (
              <section className="space-y-2" key={section.heading}>
                <h2 className="text-lg font-semibold tracking-tight">{section.heading}</h2>
                {section.body.map((paragraph) => (
                  <p className="text-sm leading-6 text-muted-foreground" key={paragraph}>
                    {paragraph}
                  </p>
                ))}
              </section>
            ))}
            <section className="space-y-2">
              <h2 className="text-lg font-semibold tracking-tight">Kontakt</h2>
              <p className="text-sm leading-6 text-muted-foreground">
                Za pitanja u vezi sa ovim dokumentom koristite našu{" "}
                <a
                  className="font-medium text-primary underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  href={getContactPath()}
                >
                  kontakt formu
                </a>
                .
              </p>
            </section>
          </CardContent>
        </Card>
      </article>
    </DashboardLayout>
  );
}

export { LegalPage, type LegalDocument };
