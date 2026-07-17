import { CommandTrigger } from "@/shared/components/layout/command-trigger";
import { LanguageSwitcher } from "@/shared/components/layout/language-switcher";
import { Navigation } from "@/shared/components/layout/navigation";
import { ResponsiveContainer } from "@/shared/components/layout/responsive-container";
import { ThemeSwitcher } from "@/shared/components/theme/theme-switcher";
import type { Locale } from "@/shared/config/locale";
import { siteConfig } from "@/shared/config/site";
import type { Translations } from "@/shared/lib/translations";

interface AppHeaderProps {
  locale: Locale;
  translations: Translations;
}

function AppHeader({ locale, translations }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <ResponsiveContainer className="flex h-16 items-center justify-between gap-4">
        <a className="shrink-0 text-sm font-semibold tracking-tight" href={`/${locale}#dashboard`}>
          {siteConfig.name}
        </a>
        <div className="hidden flex-1 justify-center md:flex">
          <Navigation locale={locale} translations={translations} />
        </div>
        <div className="flex items-center gap-2">
          <LanguageSwitcher
            label={translations.shell.languageSwitcherLabel}
            locale={locale}
            translations={translations}
          />
          <CommandTrigger label={translations.shell.commandPaletteComingSoon} />
          <ThemeSwitcher label={translations.shell.themeSwitcherLabel} />
        </div>
      </ResponsiveContainer>
    </header>
  );
}

export { AppHeader, type AppHeaderProps };
