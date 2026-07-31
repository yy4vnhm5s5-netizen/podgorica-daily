import { Building2, CalendarDays, Check, Landmark, MessageSquareText } from "lucide-react";

import { ContactForm } from "@/modules/contact/presentation/contact-form";
import { getContactTranslations } from "@/modules/contact/presentation/contact-translations";
import { PlatformAtmosphere } from "@/app/platform-atmosphere";
import { Card, CardContent } from "@/shared/components/ui/card";
import { DashboardLayout } from "@/shared/components/layout/dashboard-layout";
import type { Locale } from "@/shared/config/locale";
import type { City } from "@/shared/types/city";
import { getTranslations } from "@/shared/lib/translations";

function ContactPage({ city, locale }: { city: City; locale: Locale }) {
  const translations = getContactTranslations();

  return (
    <DashboardLayout city={city} homeHref="/" translations={getTranslations(locale)}>
      <section aria-labelledby="contact-heading" className="relative mx-auto max-w-6xl">
        <PlatformAtmosphere />
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-8">
          <Card className="card-fog card-fog--info overflow-hidden border-primary/15 bg-gradient-to-br from-sky-50/90 via-background to-violet-50/70">
            <CardContent className="p-6 sm:p-8">
              <p className="text-xs font-semibold tracking-[0.18em] text-primary">
                {translations.partnershipLabel}
              </p>
              <h1
                className="mt-4 font-display text-3xl font-semibold leading-tight tracking-tight text-slate-950 sm:text-4xl"
                id="contact-heading"
              >
                {translations.heading}
              </h1>
              <p className="mt-5 text-sm leading-7 text-muted-foreground sm:text-base">
                {translations.intro}
              </p>

              <div className="relative mt-7 overflow-hidden rounded-2xl border border-primary/10 bg-background/70 p-5 sm:p-6">
                <div
                  aria-hidden="true"
                  className="absolute -right-5 -top-6 size-28 rounded-full bg-sky-200/35 blur-2xl"
                />
                <div className="relative flex items-center gap-3">
                  <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <MessageSquareText aria-hidden="true" className="size-5" strokeWidth={1.8} />
                  </div>
                  <div className="flex items-center gap-2 text-primary/75">
                    <Landmark aria-hidden="true" className="size-4" />
                    <Building2 aria-hidden="true" className="size-4" />
                    <CalendarDays aria-hidden="true" className="size-4" />
                  </div>
                </div>
              </div>

              <ul aria-label="Prednosti saradnje sa Gradom.me" className="mt-6 space-y-3">
                {translations.trustItems.map((item) => (
                  <li className="flex gap-3 text-sm leading-6 text-slate-700" key={item}>
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                      <Check aria-hidden="true" className="size-3.5" strokeWidth={2.3} />
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card className="border-primary/15 bg-background/90">
            <CardContent className="p-6 sm:p-8">
              <h2 className="text-xl font-semibold tracking-tight text-slate-950">
                {translations.formHeading}
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {translations.formDescription}
              </p>
              <ContactForm locale={locale} />
            </CardContent>
          </Card>
        </div>
      </section>
    </DashboardLayout>
  );
}

export { ContactPage };
