import { ArrowRight, CalendarDays, CloudSun, Music2, Plane } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import {
  createPlatformHomepageStructuredData,
  formatCityNames,
  type CityHighlightVisual,
  type PlatformCityCardData,
} from "@/app/platform-homepage-data";
import { LastCityContinuation } from "@/app/platform-last-city";
import { siteConfig } from "@/shared/config/site";

interface PlatformHomepageProps {
  cards: readonly PlatformCityCardData[];
}

const highlightIcons = {
  calendar: CalendarDays,
  cloud: CloudSun,
  music: Music2,
  plane: Plane,
} satisfies Record<CityHighlightVisual, typeof CalendarDays>;

function PlatformHomepage({ cards }: PlatformHomepageProps) {
  const structuredData = createPlatformHomepageStructuredData(cards);
  const cityNames = formatCityNames(cards);

  return (
    <div className="space-y-14 sm:space-y-20">
      <script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        type="application/ld+json"
      />
      <section
        aria-labelledby="platform-homepage-title"
        className="rounded-3xl border border-blue-100 bg-gradient-to-br from-white via-blue-50/70 to-sky-100/70 px-5 py-10 shadow-sm shadow-blue-950/[0.04] sm:px-10 sm:py-14"
      >
        <Image alt={siteConfig.name} height={52} priority src={siteConfig.logoPath} width={197} />
        <div className="mt-8 max-w-3xl space-y-5">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
            Gradom.me
          </p>
          <h1
            className="max-w-2xl text-3xl font-semibold tracking-tight text-slate-950 sm:text-5xl"
            id="platform-homepage-title"
          >
            Lokalne informacije za gradove Crne Gore
          </h1>
          <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
            Vrijeme, događaji, prekidi, prevoz i druge korisne informacije za vaš grad, na jednom
            mjestu.
          </p>
        </div>
      </section>

      <section aria-labelledby="cities-heading" className="space-y-6">
        <div className="space-y-2">
          <p className="text-sm font-medium text-primary">Izaberite grad</p>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-950" id="cities-heading">
            Gradovi koje Gradom.me trenutno podržava
          </h2>
        </div>
        <LastCityContinuation cards={cards} />
        <div className="grid gap-5 lg:grid-cols-2">
          {cards.map((card) => (
            <CityCard card={card} key={card.city.id} />
          ))}
        </div>
      </section>

      <section
        aria-labelledby="how-it-works-heading"
        className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]"
      >
        <div className="space-y-4">
          <p className="text-sm font-medium text-primary">Lokalno, po gradu</p>
          <h2
            className="text-2xl font-semibold tracking-tight text-slate-950"
            id="how-it-works-heading"
          >
            Informacije koje odgovaraju svakodnevnom životu u gradu
          </h2>
          <p className="max-w-3xl leading-7 text-muted-foreground">
            Gradom.me objedinjuje javno dostupne podatke iz provjerenih izvora i prikazuje ih kroz
            gradsku stranicu. Svaki grad ima svoj skup usluga, izvora i učestalost osvježavanja —
            prikazujemo samo ono što je stvarno dostupno i korisno.
          </p>
          <p className="max-w-3xl leading-7 text-muted-foreground">
            Trenutno je dostupna {cityNames}. Kako se gradovi dodaju, njihove stranice će zadržati
            lokalni fokus, bez pretpostavke da svaki grad mora imati iste module.
          </p>
        </div>
        <aside
          className="rounded-2xl border border-blue-100 bg-blue-50/60 p-6"
          aria-label="Kako Gradom.me radi"
        >
          <h3 className="font-semibold text-slate-950">Podaci sa jasnim ograničenjima</h3>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Podaci se osvježavaju periodično i uz svaki važan prikaz zadržavamo informaciju o
            izvoru, svježini i dostupnosti. Gradom.me ne prikazuje izmišljene rasporede niti pokreće
            prikupljanje podataka tokom vaše posjete.
          </p>
        </aside>
      </section>

      <section aria-labelledby="faq-heading" className="space-y-6">
        <div className="space-y-2">
          <p className="text-sm font-medium text-primary">Česta pitanja</p>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-950" id="faq-heading">
            Gradom.me ukratko
          </h2>
        </div>
        <div className="divide-y rounded-2xl border bg-background">
          <FaqItem question="Šta je Gradom.me?">
            Gradom.me je lokalna informativna platforma za gradove Crne Gore. Na jednom mjestu
            okuplja provjerene svakodnevne informacije, uz vidljive izvore i status podataka.
          </FaqItem>
          <FaqItem question="Koje gradove Gradom.me trenutno podržava?">
            Gradom.me trenutno podržava {cityNames}. Novi gradovi će biti dodati tek kada imaju
            dovoljno pouzdanih lokalnih izvora i korisnih usluga.
          </FaqItem>
          <FaqItem question="Odakle dolaze podaci?">
            Podaci dolaze iz javno dostupnih izvora gradskih institucija, javnih preduzeća i drugih
            jasno označenih lokalnih servisa. Svaki modul čuva izvor uz relevantan sadržaj.
          </FaqItem>
          <FaqItem question="Koliko često se informacije osvježavaju?">
            Učestalost zavisi od izvora i vrste podatka. Gradom.me koristi periodično osvježene
            snimke podataka, a ne obećava prikaz u realnom vremenu.
          </FaqItem>
          <FaqItem question="Da li je korišćenje Gradom.me besplatno?">
            Da. Javne informacije na Gradom.me dostupne su bez naloga i bez naknade.
          </FaqItem>
        </div>
      </section>
    </div>
  );
}

function CityCard({ card }: { card: PlatformCityCardData }) {
  return (
    <article className="group relative overflow-hidden rounded-2xl border border-blue-100 bg-background p-6 shadow-sm shadow-blue-950/[0.03] transition-colors hover:border-blue-200 hover:bg-blue-50/40">
      <Link
        aria-label={`Otvori grad ${card.city.name}`}
        className="absolute inset-0 z-10 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        href={card.href}
      >
        <span className="sr-only">Otvori grad {card.city.name}</span>
      </Link>
      <div className="pointer-events-none relative z-20 space-y-6">
        <div className="space-y-2">
          <h3 className="text-2xl font-semibold tracking-tight text-slate-950">{card.city.name}</h3>
          <p className="max-w-xl leading-6 text-muted-foreground">
            {card.city.description ?? `Lokalne informacije za grad ${card.city.name}.`}
          </p>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2">
          {card.highlights.map((highlight) => {
            const Icon = highlightIcons[highlight.visual];
            const content = (
              <>
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-700">
                  <Icon aria-hidden="true" className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {highlight.label}
                  </span>
                  <span
                    className={`mt-0.5 block font-medium text-slate-900 ${highlight.state === "unavailable" ? "text-sm text-muted-foreground" : "truncate"}`}
                  >
                    {highlight.value}
                  </span>
                </span>
              </>
            );

            return highlight.href ? (
              <li key={highlight.key}>
                <Link
                  aria-label={highlight.accessibilityLabel}
                  className="pointer-events-auto flex min-w-0 items-center gap-3 rounded-xl border border-transparent px-2 py-1.5 transition-colors hover:border-blue-100 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  href={highlight.href}
                >
                  {content}
                </Link>
              </li>
            ) : (
              <li className="flex min-w-0 items-center gap-3 px-2 py-1.5" key={highlight.key}>
                {content}
              </li>
            );
          })}
        </ul>
        <div className="flex flex-wrap items-center gap-2 border-t border-blue-100 pt-4">
          {card.shortcuts.map((shortcut) => (
            <Link
              className="pointer-events-auto rounded-md px-2 py-1 text-sm font-medium text-primary transition-colors hover:bg-blue-100/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              href={shortcut.href}
              key={shortcut.key}
            >
              {shortcut.label}
            </Link>
          ))}
        </div>
        <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary transition-colors group-hover:text-blue-800">
          Otvori grad <ArrowRight aria-hidden="true" className="size-4" />
        </span>
      </div>
    </article>
  );
}

function FaqItem({ children, question }: { children: ReactNode; question: string }) {
  return (
    <details className="group px-5 py-4 sm:px-6">
      <summary className="cursor-pointer list-none pr-8 font-medium text-slate-950 marker:content-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
        {question}
      </summary>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">{children}</p>
    </details>
  );
}

export { CityCard, PlatformHomepage, type PlatformHomepageProps };
