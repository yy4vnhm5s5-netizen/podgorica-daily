import type { PropsWithChildren } from "react";

import { AppFooter } from "@/shared/components/layout/app-footer";
import { AppHeader } from "@/shared/components/layout/app-header";
import { MobileNavigation } from "@/shared/components/layout/mobile-navigation";
import { ResponsiveContainer } from "@/shared/components/layout/responsive-container";
import type { Translations } from "@/shared/lib/translations";

interface DashboardLayoutProps extends PropsWithChildren {
  translations: Translations;
}

function DashboardLayout({ children, translations }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-background pb-[calc(5rem+env(safe-area-inset-bottom))] text-foreground md:pb-0">
      <a
        className="absolute left-4 top-4 z-50 -translate-y-20 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-transform focus:translate-y-0"
        href="#main-content"
      >
        {translations.shell.skipToContent}
      </a>
      <AppHeader translations={translations} />
      <main id="main-content">
        <ResponsiveContainer className="py-8 sm:py-14">{children}</ResponsiveContainer>
      </main>
      <AppFooter tagline={translations.shell.tagline} translations={translations} />
      <MobileNavigation translations={translations} />
    </div>
  );
}

export { DashboardLayout, type DashboardLayoutProps };
