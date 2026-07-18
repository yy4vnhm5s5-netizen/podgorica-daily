import { LanguageSwitcher } from "@/shared/components/layout/language-switcher";
import { Navigation } from "@/shared/components/layout/navigation";
import { ResponsiveContainer } from "@/shared/components/layout/responsive-container";
import type { Locale } from "@/shared/config/locale";
import { siteConfig } from "@/shared/config/site";
import type { Translations } from "@/shared/lib/translations";

interface AppHeaderProps {
  locale: Locale;
  translations: Translations;
}

function AppHeader({ locale, translations }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-blue-100/80 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
      <ResponsiveContainer className="flex h-16 items-center justify-between gap-4">
        <a className="shrink-0 text-sm font-semibold tracking-tight text-primary" href={`/${locale}#dashboard`}>
          {siteConfig.name}
        </a>
        <div className="hidden flex-1 justify-center md:flex">
          <Navigation locale={locale} translations={translations} />
        </div>
        <LanguageSwitcher
          label={translations.shell.languageSwitcherLabel}
          locale={locale}
          translations={translations}
        />
      </ResponsiveContainer>
    </header>
  );
}

export { AppHeader, type AppHeaderProps };
