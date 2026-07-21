import { ResponsiveContainer } from "@/shared/components/layout/responsive-container";
import type { Locale } from "@/shared/config/locale";
import { isFeatureEnabled } from "@/shared/config/features";
import {
  getContactPath,
  getPrivacyPolicyPath,
  getTermsOfUsePath,
} from "@/shared/config/public-routes";
import { siteConfig } from "@/shared/config/site";
import type { Translations } from "@/shared/lib/translations";

interface AppFooterProps {
  locale: Locale;
  tagline: string;
  translations: Translations;
}

function AppFooter({ locale, tagline, translations }: AppFooterProps) {
  return (
    <footer className="border-t py-8">
      <ResponsiveContainer className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {siteConfig.name} — {tagline}
        </p>
        <nav
          aria-label={translations.shell.footer.legalNavigation}
          className="flex flex-wrap items-center gap-x-4 gap-y-2"
        >
          {isFeatureEnabled("contact") ? (
            <FooterLink href={getContactPath(locale)}>
              {translations.shell.navigation.contact}
            </FooterLink>
          ) : null}
          <FooterLink href={getTermsOfUsePath()}>{translations.shell.footer.terms}</FooterLink>
          <FooterLink href={getPrivacyPolicyPath()}>{translations.shell.footer.privacy}</FooterLink>
        </nav>
      </ResponsiveContainer>
    </footer>
  );
}

function FooterLink({ children, href }: { children: string; href: string }) {
  return (
    <a
      className="rounded-md text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      href={href}
    >
      {children}
    </a>
  );
}

export { AppFooter, type AppFooterProps };
