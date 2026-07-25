import Link from "next/link";

import { DashboardLayout } from "@/shared/components/layout/dashboard-layout";
import { Card, CardContent } from "@/shared/components/ui/card";
import { getCityPath, getContactPath } from "@/shared/config/public-routes";
import { getTranslations } from "@/shared/lib/translations";
import type { City } from "@/shared/types/city";

import { aboutPlatformContent, createAboutPlatformStructuredData } from "./about-platform-content";

function AboutPlatformPage({ city }: { city: City }) {
  const translations = getTranslations("me");
  const structuredData = createAboutPlatformStructuredData(city);

  return (
    <DashboardLayout city={city} translations={translations}>
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
                href={getCityPath(city)}
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

        <Card className="border-primary/15">
          <CardContent className="space-y-8 p-5 sm:p-7">
            {aboutPlatformContent.sections.slice(1).map((section) => (
              <section className="space-y-2" key={section.heading}>
                <h2 className="text-lg font-semibold tracking-tight">{section.heading}</h2>
                {section.body.map((paragraph) => (
                  <p className="text-sm leading-6 text-muted-foreground" key={paragraph}>
                    {paragraph}
                  </p>
                ))}
                {section.heading === "Nezavisnost i ispravke" ? (
                  <Link
                    className="inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    href={getContactPath()}
                  >
                    Kontaktirajte nas
                  </Link>
                ) : null}
              </section>
            ))}
          </CardContent>
        </Card>

        <aside className="rounded-xl border border-primary/15 bg-muted/40 p-5 sm:p-6">
          <h2 className="text-lg font-semibold tracking-tight">Važna napomena</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Informacije su dostupne u opšte informativne svrhe. Zvanične institucije i originalni
            pružaoci informacija ostaju mjerodavni, zato važne ili vremenski osjetljive podatke
            provjerite direktno kod relevantnog izvora.
          </p>
        </aside>

        <Link
          className="inline-flex rounded-md px-1 py-2 text-sm font-medium text-primary underline-offset-4 transition-colors hover:text-primary/80 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          href={getCityPath(city)}
        >
          Pogledajte informacije za Podgoricu
        </Link>
      </article>
    </DashboardLayout>
  );
}

export { AboutPlatformPage };
