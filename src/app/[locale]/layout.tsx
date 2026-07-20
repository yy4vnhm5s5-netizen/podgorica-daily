import type { Metadata } from "next";
import type { PropsWithChildren } from "react";
import { notFound } from "next/navigation";

import { getLocaleTag, isLocale, locales } from "@/shared/config/locale";
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
    alternates: { canonical: `/${locale}` },
    description: translations.metadata.description,
    title: translations.metadata.title,
  };
}

function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
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
