import { MessageSquareText } from "lucide-react";

import { ContactForm } from "@/modules/contact/presentation/contact-form";
import { getContactTranslations } from "@/modules/contact/presentation/contact-translations";
import { Card, CardContent } from "@/shared/components/ui/card";
import { DashboardLayout } from "@/shared/components/layout/dashboard-layout";
import type { Locale } from "@/shared/config/locale";
import { getTranslations } from "@/shared/lib/translations";

function ContactPage({ locale }: { locale: Locale }) {
  const translations = getContactTranslations(locale);

  return (
    <DashboardLayout translations={getTranslations(locale)}>
      <section className="mx-auto max-w-5xl space-y-8" aria-labelledby="contact-heading">
        <div className="max-w-2xl">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl" id="contact-heading">
            {translations.heading}
          </h1>
        </div>
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <Card className="border-primary/15 bg-slate-50/65">
            <CardContent className="p-5 sm:p-6">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <MessageSquareText aria-hidden="true" className="size-5" strokeWidth={1.8} />
              </div>
              <p className="mt-4 text-sm leading-6 text-muted-foreground">{translations.intro}</p>
            </CardContent>
          </Card>
          <Card className="border-primary/15">
            <CardContent className="p-5 sm:p-6">
              <ContactForm locale={locale} />
            </CardContent>
          </Card>
        </div>
      </section>
    </DashboardLayout>
  );
}

export { ContactPage };
