import Link from "next/link";

import { DashboardLayout } from "@/shared/components/layout/dashboard-layout";
import { Card, CardContent } from "@/shared/components/ui/card";
import {
  getCinemaPath,
  getCityPath,
  getContactPath,
  getElectricityPath,
  getEventsPath,
  getFlightsPath,
  getGoingOutPath,
} from "@/shared/config/public-routes";
import { getTranslations } from "@/shared/lib/translations";
import type { City } from "@/shared/types/city";

import { aboutPlatformContent, createAboutPlatformStructuredData } from "./about-platform-content";

function AboutPlatformPage({ city }: { city: City }) {
  const translations = getTranslations("me");
  const structuredData = createAboutPlatformStructuredData();

  return (
    <DashboardLayout city={city} homeHref="/" translations={translations}>
      <script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        type="application/ld+json"
      />
      <article aria-labelledby="about-platform-heading" className="mx-auto max-w-3xl space-y-8">
        <nav aria-label="Putanja">
          <ol className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <li>
              <Link
                className="underline-offset-4 hover:text-foreground hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                href="/"
              >
                Početna
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page">O platformi</li>
          </ol>
        </nav>

        <header className="space-y-3">
          <h1
            className="text-3xl font-semibold tracking-tight sm:text-4xl"
            id="about-platform-heading"
          >
            {aboutPlatformContent.heading}
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
            {aboutPlatformContent.sections[0].body[0]}
          </p>
        </header>

        <Card className="card-fog card-fog--summary border-blue-200/80 bg-blue-50/55 dark:border-blue-900 dark:bg-blue-950/35">
          <span aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-blue-300/70" />
          <CardContent className="space-y-8 p-5 sm:p-7">
            {aboutPlatformContent.sections.slice(1).map((section) => (
              <section className="space-y-2" key={section.heading}>
                <h2 className="text-lg font-semibold tracking-tight">{section.heading}</h2>
                {section.body.map((paragraph) => (
                  <p className="text-sm leading-6 text-muted-foreground" key={paragraph}>
                    {paragraph}
                  </p>
                ))}
                {section.heading === "Šta možete pronaći" ? (
                  <div className="flex flex-wrap gap-x-4 gap-y-2 pt-1 text-sm font-medium">
                    <Link className={inlineLinkClassName} href={getElectricityPath(city)}>
                      Nestanci struje
                    </Link>
                    <Link className={inlineLinkClassName} href={getFlightsPath(city)}>
                      Letovi Podgorica
                    </Link>
                    <Link className={inlineLinkClassName} href={getCinemaPath(city)}>
                      Bioskop Podgorica
                    </Link>
                    <Link className={inlineLinkClassName} href={getEventsPath(city)}>
                      Događaji Podgorica
                    </Link>
                    <Link className={inlineLinkClassName} href={getGoingOutPath(city)}>
                      Izlasci u Podgorici
                    </Link>
                  </div>
                ) : null}
                {section.heading === "Nezavisnost i ispravke" ? (
                  <Link className={inlineLinkClassName} href={getContactPath()}>
                    Kontaktirajte nas
                  </Link>
                ) : null}
              </section>
            ))}
          </CardContent>
        </Card>

        <aside className="rounded-xl border border-amber-200/80 bg-amber-50/60 p-5 dark:border-amber-900 dark:bg-amber-950/35 sm:p-6">
          <h2 className="text-lg font-semibold tracking-tight">Važna napomena</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Informacije su dostupne u opšte informativne svrhe. Zvanične institucije i originalni
            pružaoci informacija ostaju mjerodavni, zato važne ili vremenski osjetljive podatke
            provjerite direktno kod relevantnog izvora.
          </p>
        </aside>

        <Link
          className="inline-flex rounded-md px-1 py-2 text-sm font-medium text-brand-foreground underline-offset-4 transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          href={getCityPath(city)}
        >
          Pogledajte informacije za Podgoricu
        </Link>
      </article>
    </DashboardLayout>
  );
}

const inlineLinkClassName =
  "inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

export { AboutPlatformPage };
