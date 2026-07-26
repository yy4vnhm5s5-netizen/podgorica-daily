import { ArrowRight, CalendarDays, CloudSun, Music2, Plane, Zap } from "lucide-react";
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

const highlightSurfaceStyles = {
  calendar: "border-indigo-100 bg-indigo-50/75 hover:bg-indigo-50",
  cloud: "border-sky-100 bg-sky-50/80 hover:bg-sky-50",
  music: "border-fuchsia-100 bg-fuchsia-50/75 hover:bg-fuchsia-50",
  plane: "border-blue-100 bg-blue-50/80 hover:bg-blue-50",
} satisfies Record<CityHighlightVisual, string>;

const highlightIconStyles = {
  calendar: "bg-white/75 text-indigo-700",
  cloud: "bg-white/75 text-sky-700",
  music: "bg-white/75 text-fuchsia-700",
  plane: "bg-white/75 text-blue-700",
} satisfies Record<CityHighlightVisual, string>;

const shortcutIcons = {
  electricity: Zap,
  events: CalendarDays,
  flights: Plane,
  "going-out": Music2,
} as const;

const shortcutStyles = {
  electricity: "bg-amber-50 text-amber-800 hover:bg-amber-100",
  events: "bg-indigo-50 text-indigo-800 hover:bg-indigo-100",
  flights: "bg-sky-50 text-sky-800 hover:bg-sky-100",
  "going-out": "bg-fuchsia-50 text-fuchsia-800 hover:bg-fuchsia-100",
} as const;

function PlatformHomepage({ cards }: PlatformHomepageProps) {
  const structuredData = createPlatformHomepageStructuredData(cards);
  const cityNames = formatCityNames(cards);

  return (
    <div className="space-y-8 sm:space-y-10">
      <script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        type="application/ld+json"
      />
      <section
        aria-labelledby="platform-homepage-title"
        className="card-fog card-fog--info overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-r from-white via-blue-50/75 to-sky-100/65 px-5 py-4 shadow-sm shadow-blue-950/[0.04] sm:px-7 sm:py-5"
      >
        <PlatformWordmark />
        <div className="mt-4 max-w-3xl space-y-2">
          <h1
            className="max-w-2xl text-2xl font-semibold leading-tight tracking-tight text-slate-950 sm:text-3xl"
            id="platform-homepage-title"
          >
            Lokalne informacije za gradove Crne Gore
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            Izaberite grad i odmah provjerite najvažnije lokalne informacije.
          </p>
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
        <div className="space-y-3">
          {cards.map((card) => (
            <CityCard card={card} key={card.city.id} />
          ))}
        </div>
      </section>

      <section
        aria-labelledby="how-it-works-heading"
        className="grid gap-3 lg:grid-cols-[1.25fr_0.75fr]"
      >
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
        <aside
          className="card-fog card-fog--neutral rounded-xl border border-amber-100 bg-amber-50/55 px-4 py-3 sm:px-5 sm:py-3.5"
          aria-label="Kako Gradom.me radi"
        >
          <h3 className="font-semibold text-slate-950">Podaci sa jasnim ograničenjima</h3>
          <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
            Podaci se osvježavaju periodično i uz svaki važan prikaz zadržavamo informaciju o
            izvoru, svježini i dostupnosti. Gradom.me ne prikazuje izmišljene rasporede niti pokreće
            prikupljanje podataka tokom vaše posjete.
          </p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Trenutno su dostupne {cityNames}.
          </p>
        </aside>
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

function CityCard({ card }: { card: PlatformCityCardData }) {
  const highlightGridClass = card.highlights.length > 2 ? "sm:grid-cols-4" : "sm:grid-cols-2";

  return (
    <article className="group relative overflow-hidden rounded-2xl border border-slate-200/90 bg-gradient-to-r from-white via-blue-50/45 to-white shadow-sm shadow-blue-950/[0.04] transition-[border-color,box-shadow] duration-200 hover:border-blue-200 hover:shadow-[0_14px_26px_-22px_rgb(15_23_42_/_0.32)]">
      <Link
        aria-label={`Otvori grad ${card.city.name}`}
        className="absolute inset-0 z-10 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        href={card.href}
      >
        <span className="sr-only">Otvori grad {card.city.name}</span>
      </Link>
      <div className="pointer-events-none relative z-20">
        <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(12rem,0.72fr)_minmax(0,1.65fr)_auto] lg:items-center">
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Grad</p>
            <h3 className="text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl">
              {card.city.name}
            </h3>
            <p className="max-w-xs text-sm leading-5 text-muted-foreground">
              {card.city.description ?? `Lokalne informacije za grad ${card.city.name}.`}
            </p>
          </div>
          <ul className={`grid min-w-0 grid-cols-2 gap-2 ${highlightGridClass}`}>
            {card.highlights.map((highlight) => {
              const Icon = highlightIcons[highlight.visual];
              const content = (
                <>
                  <span
                    className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${highlightIconStyles[highlight.visual]}`}
                  >
                    <Icon aria-hidden="true" className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      {highlight.label}
                    </span>
                    <span
                      className={`mt-0.5 block text-sm font-semibold leading-5 text-slate-900 ${highlight.state === "unavailable" ? "text-xs font-medium leading-4 text-muted-foreground" : "truncate"}`}
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
                    className={`pointer-events-auto flex min-h-[4.5rem] min-w-0 items-center gap-2 rounded-xl border px-2.5 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${highlightSurfaceStyles[highlight.visual]}`}
                    href={highlight.href}
                  >
                    {content}
                  </Link>
                </li>
              ) : (
                <li
                  className={`flex min-h-[4.5rem] min-w-0 items-center gap-2 rounded-xl border px-2.5 py-2 ${highlightSurfaceStyles[highlight.visual]}`}
                  key={highlight.key}
                >
                  {content}
                </li>
              );
            })}
          </ul>
          <span className="inline-flex items-center justify-start gap-1 whitespace-nowrap text-sm font-semibold text-primary transition-colors group-hover:text-blue-800 lg:justify-end">
            Otvori grad <ArrowRight aria-hidden="true" className="size-4" />
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-blue-100/80 px-5 py-3 sm:px-6">
          {card.shortcuts.map((shortcut) => (
            <CityShortcut key={shortcut.key} shortcut={shortcut} />
          ))}
        </div>
      </div>
    </article>
  );
}

function CityShortcut({ shortcut }: { shortcut: PlatformCityCardData["shortcuts"][number] }) {
  const Icon = shortcutIcons[shortcut.key as keyof typeof shortcutIcons];
  const style = shortcutStyles[shortcut.key as keyof typeof shortcutStyles];

  return (
    <Link
      className={`pointer-events-auto inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${style}`}
      href={shortcut.href}
    >
      <Icon aria-hidden="true" className="size-3.5" />
      {shortcut.label}
    </Link>
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
