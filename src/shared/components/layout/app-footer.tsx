import { ResponsiveContainer } from "@/shared/components/layout/responsive-container";
import type { Locale } from "@/shared/config/locale";
import { isFeatureEnabled } from "@/shared/config/features";
import { getContactPath } from "@/shared/config/public-routes";
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
        {isFeatureEnabled("contact") ? (
          <a
            className="rounded-md text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            href={getContactPath(locale)}
          >
            {translations.shell.navigation.contact}
          </a>
        ) : null}
      </ResponsiveContainer>
    </footer>
  );
}

export { AppFooter, type AppFooterProps };
