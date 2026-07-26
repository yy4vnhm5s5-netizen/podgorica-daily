import type { PropsWithChildren } from "react";
import Link from "next/link";

import { AppFooter } from "@/shared/components/layout/app-footer";
import { AppHeader } from "@/shared/components/layout/app-header";
import { MobileNavigation } from "@/shared/components/layout/mobile-navigation";
import { ResponsiveContainer } from "@/shared/components/layout/responsive-container";
import type { City } from "@/shared/types/city";
import type { Translations } from "@/shared/lib/translations";

interface DashboardLayoutProps extends PropsWithChildren {
  brandVariant?: "default" | "platform";
  city: City;
  homeHref?: string;
  translations: Translations;
}

function DashboardLayout({
  brandVariant,
  children,
  city,
  homeHref,
  translations,
}: DashboardLayoutProps) {
  const isCityScoped = homeHref === undefined;

  return (
    <div className="min-h-screen bg-background pb-[calc(5rem+env(safe-area-inset-bottom))] text-foreground md:pb-0">
      <a
        className="absolute left-4 top-4 z-50 -translate-y-20 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-transform focus:translate-y-0"
        href="#main-content"
      >
        {translations.shell.skipToContent}
      </a>
      <AppHeader
        brandVariant={brandVariant}
        city={city}
        homeHref={homeHref}
        translations={translations}
      />
      <main id="main-content">
        <ResponsiveContainer className="py-6 sm:py-10">
          {isCityScoped ? (
            <Link
              className="mb-6 inline-flex rounded-md text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              href="/"
            >
              Povratak na izbor gradova
            </Link>
          ) : null}
          {children}
        </ResponsiveContainer>
      </main>
      <AppFooter tagline={translations.shell.tagline} translations={translations} />
      <MobileNavigation city={city} homeHref={homeHref} translations={translations} />
    </div>
  );
}

export { DashboardLayout, type DashboardLayoutProps };
