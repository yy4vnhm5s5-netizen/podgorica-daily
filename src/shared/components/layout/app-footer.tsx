import Link from "next/link";

import { ResponsiveContainer } from "@/shared/components/layout/responsive-container";
import { getActiveCities } from "@/shared/config/cities";
import { isFeatureEnabled } from "@/shared/config/features";
import {
  getAboutPlatformPath,
  getContactPath,
  getCityPath,
  getPrivacyPolicyPath,
  getTermsOfUsePath,
} from "@/shared/config/public-routes";
import { siteConfig } from "@/shared/config/site";
import type { Translations } from "@/shared/lib/translations";

interface AppFooterProps {
  translations: Translations;
}

const footerLinkClassName =
  "rounded-md text-sm font-medium leading-5 text-muted-foreground underline-offset-4 transition-colors hover:text-brand-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

function AppFooter({ translations }: AppFooterProps) {
  const cities = [...getActiveCities()].sort((left, right) => {
    if (left.isMain !== right.isMain) return left.isMain ? -1 : 1;
    return left.name.localeCompare(right.name, "sr-Latn-ME");
  });

  return (
    <footer className="border-t border-border/80 py-8 sm:py-9">
      <ResponsiveContainer className="space-y-6">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.45fr)_repeat(3,minmax(0,1fr))] lg:gap-8">
          <section aria-labelledby="footer-product-heading" className="space-y-2">
            <h2 className="text-sm font-semibold text-foreground" id="footer-product-heading">
              {siteConfig.name}
            </h2>
            <p className="max-w-xs text-sm leading-5 text-muted-foreground">
              Lokalne informacije na jednom mjestu: gradski servisi, događaji, letovi, kupališta i
              drugo.
            </p>
          </section>

          <nav aria-labelledby="footer-cities-heading" className="space-y-2">
            <h2 className="text-sm font-semibold text-foreground" id="footer-cities-heading">
              Gradovi
            </h2>
            <ul className="space-y-1.5">
              {cities.map((city) => (
                <li key={city.id}>
                  <FooterLink href={getCityPath(city)}>{city.name}</FooterLink>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-labelledby="footer-platform-heading" className="space-y-2">
            <h2 className="text-sm font-semibold text-foreground" id="footer-platform-heading">
              Platforma
            </h2>
            <ul className="space-y-1.5">
              <li>
                <FooterLink href={getAboutPlatformPath()}>
                  {translations.shell.footer.aboutPlatform}
                </FooterLink>
              </li>
              {isFeatureEnabled("contact") ? (
                <li>
                  <FooterLink href={getContactPath()}>
                    {translations.shell.navigation.contact}
                  </FooterLink>
                </li>
              ) : null}
              <li>
                <FooterLink href="/#faq-heading">FAQ</FooterLink>
              </li>
              <li>
                <FooterLink href={getPrivacyPolicyPath()}>
                  {translations.shell.footer.privacy}
                </FooterLink>
              </li>
              <li>
                <FooterLink href={getTermsOfUsePath()}>
                  {translations.shell.footer.terms}
                </FooterLink>
              </li>
            </ul>
          </nav>

          <section aria-labelledby="footer-tracked-heading" className="space-y-2">
            <h2 className="text-sm font-semibold text-foreground" id="footer-tracked-heading">
              Šta pratimo
            </h2>
            <ul className="space-y-1.5 text-sm leading-5 text-muted-foreground">
              <li>Gradske usluge</li>
              <li>Događaji</li>
              <li>Letovi</li>
              <li>Kupališta</li>
              <li>Lokalne informacije</li>
            </ul>
          </section>
        </div>

        <div className="space-y-2.5 border-t border-border/80 pt-4 text-center">
          <p className="mx-auto max-w-4xl text-[13px] italic leading-5 text-muted-foreground">
            Podaci se prikupljaju iz zvaničnih i javno dostupnih izvora, uključujući gradske službe,
            javna preduzeća, državne institucije i organizatore događaja.
          </p>
          <nav aria-label="Gradovi na Gradom.me">
            <ul className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
              {cities.map((city, index) => (
                <li className="flex items-center gap-x-2" key={city.id}>
                  {index > 0 ? (
                    <span aria-hidden="true" className="text-muted-foreground/60">
                      •
                    </span>
                  ) : null}
                  <FooterLink className="text-[13px]" href={getCityPath(city)}>
                    {city.name}
                  </FooterLink>
                </li>
              ))}
            </ul>
          </nav>
          <p className="text-[13px] leading-5 text-muted-foreground">© 2026 {siteConfig.name}</p>
        </div>
      </ResponsiveContainer>
    </footer>
  );
}

function FooterLink({
  children,
  className,
  href,
}: {
  children: string;
  className?: string;
  href: string;
}) {
  return (
    <Link className={`${footerLinkClassName} ${className ?? ""}`} href={href}>
      {children}
    </Link>
  );
}

export { AppFooter, type AppFooterProps };
