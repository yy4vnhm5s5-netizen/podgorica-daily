const locales = ["me", "en"] as const;
const publicLocales = ["me"] as const;

type Locale = (typeof locales)[number];
type PublicLocale = (typeof publicLocales)[number];

const defaultLocale: Locale = "me";

const localeTags: Record<Locale, string> = {
  en: "en",
  me: "sr-Latn-ME",
};

function isLocale(value: string): value is Locale {
  return locales.includes(value as Locale);
}

function getLocaleTag(locale: Locale) {
  return localeTags[locale];
}

function getLocaleAlternates(pathname = "") {
  const suffix = pathname ? (pathname.startsWith("/") ? pathname : `/${pathname}`) : "";
  const primaryPath = `/me${suffix}`;

  return {
    "sr-Latn-ME": primaryPath,
    "x-default": primaryPath,
  };
}

export {
  defaultLocale,
  getLocaleAlternates,
  getLocaleTag,
  isLocale,
  locales,
  publicLocales,
  type Locale,
  type PublicLocale,
};
