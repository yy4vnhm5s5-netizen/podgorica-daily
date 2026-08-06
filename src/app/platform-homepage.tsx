import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import {
  createPlatformHomepageStructuredData,
  formatCityNames,
  type PlatformCityCardData,
} from "@/app/platform-homepage-data";
import { CityCard } from "@/app/platform-city-panel";
import { PlatformAtmosphere } from "@/app/platform-atmosphere";
import { PlatformCityIndex } from "@/app/platform-city-index";
import { getFuelPricesPath } from "@/shared/config/public-routes";
import { PlatformCitySelector } from "@/app/platform-city-selector";
import { LastCityContinuation } from "@/app/platform-last-city";
import {
  DecorativeIconBleed,
  platformCitiesSectionIcons,
  platformFaqSectionIcons,
  platformHeroSectionIcons,
  platformHowItWorksSectionIcons,
} from "@/shared/components/hero-icon-backdrop";
import { siteConfig } from "@/shared/config/site";

interface PlatformHomepageProps {
  cards: readonly PlatformCityCardData[];
}

function PlatformHomepage({ cards }: PlatformHomepageProps) {
  const structuredData = createPlatformHomepageStructuredData(cards);
  const cityNames = formatCityNames(cards);
  const faqItems: readonly { answer: ReactNode; question: string }[] = [
    {
      answer: (
        <>
          Gradom.me je lokalna informativna platforma za gradove Crne Gore. Na jednom mjestu okuplja
          provjerene svakodnevne informacije, uz vidljive izvore i status podataka.
        </>
      ),
      question: "Šta je Gradom.me?",
    },
    {
      answer: (
        <>
          Gradom.me trenutno podržava {cityNames}. Novi gradovi će biti dodati tek kada imaju
          dovoljno pouzdanih lokalnih izvora i korisnih usluga.
        </>
      ),
      question: "Koje gradove Gradom.me trenutno podržava?",
    },
    {
      answer: (
        <>
          Podaci dolaze iz javno dostupnih izvora gradskih institucija, javnih preduzeća i drugih
          jasno označenih lokalnih servisa. Svaki modul čuva izvor uz relevantan sadržaj.
        </>
      ),
      question: "Odakle dolaze podaci?",
    },
    {
      answer: (
        <>
          Učestalost zavisi od izvora i vrste podatka. Gradom.me koristi periodično osvježene snimke
          podataka, a ne obećava prikaz u realnom vremenu.
        </>
      ),
      question: "Koliko često se informacije osvježavaju?",
    },
    {
      answer: <>Da. Javne informacije na Gradom.me dostupne su bez naloga i bez naknade.</>,
      question: "Da li je korišćenje Gradom.me besplatno?",
    },
  ];

  return (
    <div className="relative">
      <PlatformAtmosphere />
      <script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        type="application/ld+json"
      />
      {/* Hero SECTION: background → decorative icons → hero CARD → hero content. Each major
          section below carries its OWN small icon group, anchored to that section's own edges
          (see hero-icon-backdrop.tsx for why: it keeps every icon's position independent of how
          tall any OTHER section on the page happens to be) — together they still read as one
          page-wide, non-clustered atmosphere, just without a single fragile page-height
          percentage tying every icon to every section's combined height. */}
      <section aria-labelledby="platform-homepage-title" className="relative">
        <DecorativeIconBleed icons={platformHeroSectionIcons} />
        <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-r from-white via-orange-50/30 to-sky-100/40 px-5 py-4 shadow-sm shadow-slate-950/[0.04] sm:px-6 sm:py-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <PlatformMark />
            <div className="max-w-2xl space-y-1.5 sm:border-l sm:border-border/60 sm:pl-6">
              <h1
                className="font-display text-2xl font-semibold leading-snug tracking-normal text-slate-950 sm:text-3xl"
                id="platform-homepage-title"
              >
                Lokalne informacije za gradove Crne Gore
              </h1>
              <p className="text-sm leading-6 text-muted-foreground sm:text-base">
                Izaberite grad i odmah provjerite najvažnije lokalne informacije.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Tighter gap here than after this section: the city selector is the page's main event and
          should follow the hero closely, not after the same beat every other section gets. */}
      <section aria-labelledby="cities-heading" className="relative mt-6 space-y-3 sm:mt-8">
        <DecorativeIconBleed icons={platformCitiesSectionIcons} />
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-foreground">
              Izaberite grad
            </p>
            <h2
              className="font-display text-xl font-semibold leading-snug tracking-normal text-slate-950 sm:text-2xl"
              id="cities-heading"
            >
              Vaš gradski pregled
            </h2>
          </div>
        </div>
        <LastCityContinuation cards={cards} />
        <PlatformCitySelector cards={cards} />
        <PlatformCityIndex />
      </section>

      {/* The one national page the platform has. It sits after the city block because choosing a
          city is still the page's main job, and before the supporting content because a price
          everyone in the country pays is more useful than an explanation of how the site works.
          A teaser only: the figures, the chart and the history stay on /gorivo. */}
      <section aria-labelledby="fuel-heading" className="relative mt-10 sm:mt-12">
        <div className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-amber-100/60 px-5 py-4 sm:px-6 sm:py-5">
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
            <div className="max-w-2xl space-y-1.5">
              <p className="text-xs font-medium uppercase tracking-wide text-amber-700">
                Cijela Crna Gora
              </p>
              <h2
                className="text-lg font-semibold tracking-tight text-slate-950 sm:text-xl"
                id="fuel-heading"
              >
                Cijene goriva u Crnoj Gori
              </h2>
              <p className="text-sm leading-6 text-muted-foreground">
                Zvanične maksimalne maloprodajne cijene naftnih derivata, sa datumom važenja.
              </p>
            </div>
            <Link
              className="focus-visible:ring-ring inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg border border-amber-300 bg-background/80 px-4 text-sm font-semibold text-amber-900 transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              href={getFuelPricesPath()}
            >
              Pogledaj cijene goriva
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* More generous gap before this section: it closes out the "decide which city" zone above
          and opens the page's lighter, less time-sensitive supporting content. */}
      <section aria-labelledby="how-it-works-heading" className="relative mt-10 sm:mt-12">
        <DecorativeIconBleed icons={platformHowItWorksSectionIcons} />
        <div className="rounded-xl border border-border bg-background px-5 py-3.5 sm:px-6 sm:py-4">
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

      {/* Tighter gap here — how-it-works and FAQ are both lighter, closely related supporting
          content, so they share one rhythm beat instead of each getting the full section gap. */}
      <section
        aria-labelledby="faq-heading"
        className="relative mt-6 space-y-5 sm:mt-8 sm:space-y-6"
      >
        <DecorativeIconBleed icons={platformFaqSectionIcons} />
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-foreground">
            FAQ
          </p>
          <h2
            className="font-display text-xl font-semibold leading-snug tracking-normal text-slate-950 sm:text-2xl"
            id="faq-heading"
          >
            Gradom.me ukratko
          </h2>
        </div>
        <div>
          {faqItems.map(({ answer, question }, index) => (
            <FaqItem index={index + 1} key={question} question={question}>
              {answer}
            </FaqItem>
          ))}
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

function FaqItem({
  children,
  index,
  question,
}: {
  children: ReactNode;
  index: number;
  question: string;
}) {
  return (
    <details className="group border-b border-border/70 first:border-t">
      <summary
        aria-controls={`faq-answer-${index}`}
        className="grid min-h-16 cursor-pointer list-none grid-cols-[2.5rem_minmax(0,1fr)_1.5rem] items-center gap-3 px-1 py-5 transition-colors marker:content-none hover:text-primary focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:grid-cols-[3rem_minmax(0,1fr)_2rem] sm:px-2 sm:py-6"
      >
        <span className="text-xs font-medium tabular-nums text-muted-foreground">
          {String(index).padStart(2, "0")}
        </span>
        <span className="font-medium text-slate-950">{question}</span>
        <span
          aria-hidden="true"
          className="justify-self-end text-xl font-light leading-none text-muted-foreground"
        >
          <span className="group-open:hidden">+</span>
          <span className="hidden group-open:inline">−</span>
        </span>
      </summary>
      <p
        className="max-w-3xl pb-5 pl-[3.5rem] pr-8 text-sm leading-6 text-muted-foreground sm:pb-6 sm:pl-[4.25rem] sm:pr-10"
        id={`faq-answer-${index}`}
      >
        {children}
      </p>
    </details>
  );
}

export { CityCard, PlatformHomepage, type PlatformHomepageProps };
