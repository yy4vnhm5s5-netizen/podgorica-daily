import type { Metadata } from "next";
import type { PropsWithChildren } from "react";
import { notFound } from "next/navigation";

import { getLocaleAlternates, getLocaleTag, isLocale, publicLocales } from "@/shared/config/locale";
import { siteConfig } from "@/shared/config/site";
import { getTranslations } from "@/shared/lib/translations";

interface LocaleLayoutProps extends PropsWithChildren {
  params: Promise<{ locale: string }>;
}

async function generateMetadata({ params }: LocaleLayoutProps): Promise<Metadata> {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  const translations = getTranslations(locale);

  return {
    alternates: { canonical: `/${locale}`, languages: getLocaleAlternates() },
    description: translations.metadata.description,
    openGraph: {
      description: translations.metadata.description,
      title: siteConfig.homepageTitle,
      url: `/${locale}`,
    },
    title: { absolute: siteConfig.homepageTitle },
    twitter: {
      description: translations.metadata.description,
      title: siteConfig.homepageTitle,
    },
  };
}

function generateStaticParams() {
  return publicLocales.map((locale) => ({ locale }));
}

async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  return <div lang={getLocaleTag(locale)}>{children}</div>;
}

export { generateMetadata, generateStaticParams };
export default LocaleLayout;
