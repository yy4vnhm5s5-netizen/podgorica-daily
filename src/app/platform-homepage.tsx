import Image from "next/image";
import type { ReactNode } from "react";

import {
  createPlatformHomepageStructuredData,
  formatCityNames,
  type PlatformCityCardData,
} from "@/app/platform-homepage-data";
import { CityCard } from "@/app/platform-city-panel";
import { PlatformAtmosphere } from "@/app/platform-atmosphere";
import { PlatformCitySelector } from "@/app/platform-city-selector";
import { LastCityContinuation } from "@/app/platform-last-city";
import { siteConfig } from "@/shared/config/site";

interface PlatformHomepageProps {
  cards: readonly PlatformCityCardData[];
}

function PlatformHomepage({ cards }: PlatformHomepageProps) {
  const structuredData = createPlatformHomepageStructuredData(cards);
  const cityNames = formatCityNames(cards);

  return (
    <div className="relative space-y-8 sm:space-y-10">
      <PlatformAtmosphere />
      <script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        type="application/ld+json"
      />
      <section
        aria-labelledby="platform-homepage-title"
        className="card-fog card-fog--info overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-r from-white via-orange-50/50 to-sky-100/60 px-6 py-5 shadow-sm shadow-blue-950/[0.04] sm:px-8 sm:py-6"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
          <PlatformMark />
          <div className="max-w-2xl space-y-1.5 sm:border-l sm:border-border/60 sm:pl-6">
            <h1
              className="text-2xl font-semibold leading-tight tracking-tight text-slate-950 sm:text-3xl"
              id="platform-homepage-title"
            >
              Lokalne informacije za gradove Crne Gore
            </h1>
            <p className="text-sm leading-6 text-muted-foreground sm:text-base">
              Izaberite grad i odmah provjerite najvažnije lokalne informacije.
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="cities-heading" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-semibold uppercase tracking-wide text-brand-foreground">
              Izaberite grad
            </p>
            <h2
              className="text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl"
              id="cities-heading"
            >
              Vaš gradski pregled
            </h2>
          </div>
        </div>
        <LastCityContinuation cards={cards} />
        <PlatformCitySelector cards={cards} />
      </section>

      <section aria-labelledby="how-it-works-heading">
        <div className="rounded-xl border border-border bg-background px-5 py-4 sm:px-6 sm:py-5">
          <p className="text-xs font-medium uppercase tracking-wide text-primary">
            Lokalno, po gradu
          </p>
          <h2
            className="mt-1.5 text-lg font-semibold tracking-tight text-slate-950 sm:text-xl"
            id="how-it-works-heading"
          >
            Informacije za svakodnevni život
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Gradom.me objedinjuje javno dostupne podatke iz provjerenih izvora i prikazuje ih kroz
            gradsku stranicu. Svaki grad ima svoj skup usluga, izvora i učestalost osvježavanja.
          </p>
        </div>
      </section>

      <section aria-labelledby="faq-heading" className="space-y-3">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-primary">Česta pitanja</p>
          <h2
            className="text-lg font-semibold tracking-tight text-slate-950 sm:text-xl"
            id="faq-heading"
          >
            Gradom.me ukratko
          </h2>
        </div>
        <div className="divide-y rounded-xl border bg-background">
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

function PlatformMark() {
  return (
    <Image
      alt=""
      aria-hidden="true"
      className="h-12 w-auto shrink-0"
      height={316}
      priority
      src={siteConfig.logoMarkPath}
      width={316}
    />
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
