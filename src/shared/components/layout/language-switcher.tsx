import { locales, type Locale } from "@/shared/config/locale";
import type { Translations } from "@/shared/lib/translations";

interface LanguageSwitcherProps {
  label: string;
  locale: Locale;
  translations: Translations;
}

function LanguageSwitcher({ label, locale, translations }: LanguageSwitcherProps) {
  return (
    <nav aria-label={label}>
      <ul className="flex items-center rounded-md border bg-muted/50 p-0.5 text-xs font-medium">
        {locales.map((item) => {
          const isCurrent = item === locale;

          return (
            <li key={item}>
              <a
                aria-current={isCurrent ? "page" : undefined}
                className={
                  isCurrent
                    ? "block rounded-sm bg-background px-2 py-1 text-foreground shadow-sm"
                    : "block rounded-sm px-2 py-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                }
                href={`/${item}`}
                hrefLang={item === "me" ? "sr-Latn-ME" : "en"}
                lang={item === "me" ? "sr-Latn-ME" : "en"}
              >
                {translations.shell.languageNames[item]}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export { LanguageSwitcher, type LanguageSwitcherProps };
