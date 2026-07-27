import Image from "next/image";
import type { ReactNode } from "react";

import {
  createPlatformHomepageStructuredData,
  formatCityNames,
  type PlatformCityCardData,
} from "@/app/platform-homepage-data";
import { CityCard } from "@/app/platform-city-panel";
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
    <div className="relative space-y-6 sm:space-y-8">
      <HomepageAtmosphere />
      <script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        type="application/ld+json"
      />
      <section
        aria-labelledby="platform-homepage-title"
        className="card-fog card-fog--info overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-r from-white via-blue-50/70 to-sky-100/60 px-5 py-4 shadow-sm shadow-blue-950/[0.04] sm:px-6"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <PlatformWordmark />
          <div className="max-w-2xl space-y-1 sm:border-l sm:border-blue-100/80 sm:pl-4">
            <h1
              className="text-xl font-semibold leading-tight tracking-tight text-slate-950 sm:text-2xl"
              id="platform-homepage-title"
            >
              Lokalne informacije za gradove Crne Gore
            </h1>
            <p className="text-sm leading-6 text-muted-foreground">
              Izaberite grad i odmah provjerite najvažnije lokalne informacije.
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="cities-heading" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-medium text-primary">Izaberite grad</p>
            <h2
              className="text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl"
              id="cities-heading"
            >
              Vaš gradski pregled
            </h2>
          </div>
          <p className="text-sm text-muted-foreground">Aktuelni podaci i provjereni izvori</p>
        </div>
        <LastCityContinuation cards={cards} />
        <PlatformCitySelector cards={cards} />
      </section>

      <section aria-labelledby="how-it-works-heading">
        <div className="rounded-xl border border-border bg-background px-4 py-3 sm:px-5 sm:py-3.5">
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

// Homepage-only atmosphere, built as layered CSS gradient fields rather than discrete blurred
// "blob" divs — the previous 8-blob version still read as separate shapes no matter how much
// they were resized or spread out. Radial-gradient stops that fade to transparent are inherently
// soft and continuous with no filter/blur needed, and stacking a few of them in one layer lets
// them blend into each other instead of remaining visually separate objects. Three layers, each
// serving one job: (1) broad mesh fields for overall shape, (2) one soft directional linear wash
// (brighter upper canvas, near-neutral by mid-page, a faint cool tint at the very bottom), and
// (3) two small corner accents for a touch of extra depth. The wrapper keeps the same full-bleed
// breakout (left-1/2 + w-screen + -translate-x-1/2) and the same upward top extension (-top-40)
// used previously, so it still reaches the real viewport edges/corners with no hard cutoff at the
// homepage's own top boundary and no horizontal/vertical overflow. Painted before all other
// homepage children so normal DOM paint order keeps it behind every section — same convention as
// the shared shell's contour motif, which stays layered underneath and secondary to it.
function HomepageAtmosphere() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute -top-40 bottom-0 left-1/2 w-screen -translate-x-1/2 overflow-hidden"
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: [
            "radial-gradient(60% 55% at 20% 12%, hsl(199 70% 88% / 0.35) 0%, transparent 72%)",
            "radial-gradient(58% 50% at 82% 6%, hsl(212 62% 90% / 0.28) 0%, transparent 74%)",
            "radial-gradient(65% 58% at 88% 46%, hsl(233 40% 88% / 0.16) 0%, transparent 76%)",
          ].join(", "),
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(165deg, hsl(200 55% 97% / 0.55) 0%, transparent 42%, transparent 62%, hsl(230 35% 94% / 0.2) 100%)",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: [
            "radial-gradient(28% 24% at 94% 8%, hsl(195 72% 80% / 0.22) 0%, transparent 70%)",
            "radial-gradient(24% 20% at 4% 84%, hsl(226 42% 82% / 0.14) 0%, transparent 70%)",
          ].join(", "),
        }}
      />
    </div>
  );
}

function PlatformWordmark() {
  return (
    <div aria-label={siteConfig.name} className="flex h-8 w-[116px] items-center overflow-hidden">
      <span aria-hidden="true" className="relative h-8 w-7 shrink-0 overflow-hidden">
        <Image
          alt=""
          className="absolute left-0 top-0 h-8 w-auto max-w-none"
          height={140}
          priority
          src={siteConfig.logoPath}
          width={530}
        />
      </span>
      <span aria-hidden="true" className="relative ml-0.5 h-8 w-[70px] shrink-0 overflow-hidden">
        <Image
          alt=""
          className="absolute -left-[51px] top-0 h-8 w-auto max-w-none"
          height={140}
          priority
          src={siteConfig.logoPath}
          width={530}
        />
      </span>
    </div>
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
