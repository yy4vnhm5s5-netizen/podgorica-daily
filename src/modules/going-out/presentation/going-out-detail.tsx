import { CalendarClock, ExternalLink, MapPin, Music2, Tag, Ticket, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import type { GoingOutEvent } from "../domain/going-out-event.ts";
import { formatGoingOutSchedule } from "./going-out-ui-model";
import { getGoingOutDetailBreadcrumbTrail } from "./going-out-detail-structured-data";
import { Card, CardContent, CardHeader } from "@/shared/components/ui/card";
import { ExploreCityLinks } from "@/shared/components/explore-city-links";
import { NewTabNotice } from "@/shared/components/new-tab-notice";
import { SectionTitle } from "@/shared/components/section-title";
import type { Locale } from "@/shared/config/locale";
import { getGoingOutPath } from "@/shared/config/public-routes";
import type { City } from "@/shared/types/city";

interface GoingOutDetailProps {
  city: City;
  event: GoingOutEvent;
  locale: Locale;
  stale: boolean;
}

function GoingOutDetail({ city, event, locale, stale }: GoingOutDetailProps) {
  const breadcrumb = getGoingOutDetailBreadcrumbTrail(city, event);
  const admission = event.isFree ? "Besplatan ulaz" : event.priceLabel;

  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <nav aria-label="Putanja" className="text-xs leading-5 text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-x-1.5">
          {breadcrumb.map((step, index) => {
            const isCurrent = index === breadcrumb.length - 1;
            return (
              <li className="flex items-center gap-x-1.5" key={step.href}>
                {index > 0 ? <span aria-hidden="true">/</span> : null}
                {isCurrent ? (
                  <span aria-current="page">{step.name}</span>
                ) : (
                  <Link
                    className="underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    href={step.href}
                  >
                    {step.name}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      {stale ? (
        <p
          className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          role="status"
        >
          Prikazani su posljednji dostupni podaci.
        </p>
      ) : null}

      <Card className="overflow-hidden">
        {event.imageUrl ? (
          <Image
            alt=""
            className="aspect-[16/8] w-full object-cover"
            height={360}
            src={event.imageUrl}
            unoptimized
            width={720}
          />
        ) : null}
        <CardHeader className="gap-4 p-5 sm:p-8">
          <SectionTitle
            accent={false}
            as="h1"
            icon={Music2}
            iconClassName="bg-gradient-to-br from-violet-400 to-violet-600 text-white shadow-violet-900/20"
            id="going-out-detail-heading"
            title={event.title}
          />
        </CardHeader>
        <CardContent className="space-y-6 p-5 pt-0 sm:p-8 sm:pt-0">
          <dl className="grid gap-4 border-y py-5 text-sm sm:grid-cols-2">
            <GoingOutDetailItem
              icon={CalendarClock}
              label="Datum i vrijeme"
              value={formatGoingOutSchedule(event, locale)}
            />
            <GoingOutDetailItem icon={MapPin} label="Grad" value={city.name} />
            <GoingOutDetailItem icon={MapPin} label="Mjesto" value={event.venue} />
            <GoingOutDetailItem icon={MapPin} label="Adresa" value={event.address} />
            <GoingOutDetailItem
              icon={Users}
              label="Izvođači"
              value={event.performers?.join(", ")}
            />
            <GoingOutDetailItem icon={Tag} label="Tip događaja" value={event.eventType} />
            <GoingOutDetailItem icon={Music2} label="Žanr" value={event.genre} />
            <GoingOutDetailItem icon={Ticket} label="Ulaz" value={admission} />
            <GoingOutDetailItem icon={Users} label="Organizator" value={event.organizer} />
          </dl>

          {event.description ? (
            <section aria-labelledby="going-out-description-heading" className="space-y-2">
              <h2
                className="text-lg font-semibold tracking-tight"
                id="going-out-description-heading"
              >
                O događaju
              </h2>
              <p className="leading-7 text-muted-foreground">{event.description}</p>
            </section>
          ) : null}

          {event.informationUrl ? (
            <a
              className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border px-4 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              href={event.informationUrl}
              rel="noreferrer"
              target="_blank"
            >
              Više informacija
              <NewTabNotice locale={locale} />
              <ExternalLink aria-hidden="true" className="size-4" />
            </a>
          ) : null}

          <p className="text-sm italic text-muted-foreground">
            Izvor:{" "}
            <a
              className="underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              href={event.sourceUrl}
              rel="noreferrer"
              target="_blank"
            >
              MonteGigs
              <NewTabNotice locale={locale} />
            </a>
          </p>
        </CardContent>
      </Card>

      <Link
        className="inline-flex min-h-11 items-center gap-2 rounded-md px-1 text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        href={getGoingOutPath(city)}
      >
        ← Svi izlasci
      </Link>
      <ExploreCityLinks city={city} exclude={["goingOut"]} />
    </article>
  );
}

function GoingOutDetailItem({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CalendarClock;
  label: string;
  value?: string;
}) {
  if (!value) return null;

  return (
    <div className="flex gap-3">
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div>
        <dt className="text-muted-foreground">{label}</dt>
        <dd className="mt-0.5 font-medium">{value}</dd>
      </div>
    </div>
  );
}

export { GoingOutDetail, type GoingOutDetailProps };
