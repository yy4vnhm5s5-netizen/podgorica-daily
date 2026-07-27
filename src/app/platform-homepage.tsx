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

// Homepage-only atmosphere, scoped to the hero + city-selector zone rather than the whole page —
// spreading one mesh across the entire page reads as sterile on short mobile viewports, since
// there's no "canvas" length left for it to compose within. This is a hero canvas instead: two
// mesh-field radials plus one directional linear wash, confined to a fixed-height band pinned to
// the top of the page and faded out via a mask (not a hard bottom edge) so it blends into the
// plain white lower sections naturally. The `-top-*` extension avoids a hard cutoff at the
// homepage's own top boundary, same reasoning as before. Mobile and tablet/desktop each render
// their own band so they can carry different gradient/mask values — mobile is tuned richer (larger,
// more overlapping mesh fields, a brighter wash, and a longer fade tail) since a short mobile
// viewport has less canvas for the effect to read against; the desktop band's own values and its
// opacity ramp (full at sm, easing to lg:opacity-60) stay comparatively restrained. A near-invisible
// noise layer (2% opacity, overlay blend) sits on top for texture. Full-bleed breakout (left-1/2 +
// w-screen + -translate-x-1/2) unchanged, still reaches real viewport edges with no
// horizontal/vertical overflow. Painted before all other homepage children so normal DOM paint
// order keeps it behind every section — same convention as the shared shell's contour motif, which
// stays layered underneath and secondary to it.
function HomepageAtmosphere() {
  const desktopMesh = [
    "radial-gradient(65% 60% at 18% 8%, hsl(199 70% 88% / 0.4) 0%, transparent 72%)",
    "radial-gradient(60% 55% at 84% 4%, hsl(212 62% 90% / 0.32) 0%, transparent 74%)",
    "radial-gradient(70% 62% at 90% 42%, hsl(233 40% 88% / 0.18) 0%, transparent 76%)",
  ].join(", ");
  const desktopWash =
    "linear-gradient(165deg, hsl(200 55% 97% / 0.6) 0%, transparent 55%, hsl(230 35% 94% / 0.15) 100%)";
  const desktopMask = "linear-gradient(to bottom, black 0%, black 45%, transparent 92%)";

  const mobileMesh = [
    "radial-gradient(74% 68% at 16% 6%, hsl(199 70% 88% / 0.46) 0%, transparent 74%)",
    "radial-gradient(68% 62% at 86% 2%, hsl(212 62% 90% / 0.37) 0%, transparent 76%)",
    "radial-gradient(78% 70% at 92% 40%, hsl(233 40% 88% / 0.22) 0%, transparent 78%)",
  ].join(", ");
  const mobileWash =
    "linear-gradient(165deg, hsl(200 55% 97% / 0.72) 0%, transparent 60%, hsl(230 35% 94% / 0.18) 100%)";
  const mobileMask = "linear-gradient(to bottom, black 0%, black 42%, transparent 97%)";

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute -top-28 left-1/2 h-[42rem] w-screen -translate-x-1/2 overflow-hidden sm:h-[34rem]"
    >
      <div
        className="absolute inset-0 sm:hidden"
        style={{ WebkitMaskImage: mobileMask, maskImage: mobileMask }}
      >
        <div className="absolute inset-0" style={{ backgroundImage: mobileMesh }} />
        <div className="absolute inset-0" style={{ backgroundImage: mobileWash }} />
      </div>
      <div
        className="absolute inset-0 hidden sm:block"
        style={{ WebkitMaskImage: desktopMask, maskImage: desktopMask }}
      >
        <div className="absolute inset-0 opacity-75 lg:opacity-60" style={{ backgroundImage: desktopMesh }} />
        <div className="absolute inset-0 opacity-75 lg:opacity-60" style={{ backgroundImage: desktopWash }} />
      </div>
      <div
        className="absolute inset-0 opacity-[0.02] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
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
