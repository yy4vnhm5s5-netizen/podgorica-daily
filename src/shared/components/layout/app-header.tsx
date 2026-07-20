import Image from "next/image";

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
        <a
          aria-label={siteConfig.name}
          className="shrink-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          href={`/${locale}#dashboard`}
        >
          <Image
            alt={siteConfig.name}
            className="h-9 w-auto"
            height={36}
            priority
            src={siteConfig.logoPath}
            width={120}
          />
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
