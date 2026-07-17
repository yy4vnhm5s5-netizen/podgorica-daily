import type { PropsWithChildren } from "react";

import { AppFooter } from "@/shared/components/layout/app-footer";
import { AppHeader } from "@/shared/components/layout/app-header";
import { MobileNavigation } from "@/shared/components/layout/mobile-navigation";
import { ResponsiveContainer } from "@/shared/components/layout/responsive-container";

function DashboardLayout({ children }: PropsWithChildren) {
  return (
    <div className="min-h-screen bg-background pb-[calc(5rem+env(safe-area-inset-bottom))] text-foreground md:pb-0">
      <a
        className="absolute left-4 top-4 z-50 -translate-y-20 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-transform focus:translate-y-0"
        href="#main-content"
      >
        Skip to content
      </a>
      <AppHeader />
      <main id="main-content">
        <ResponsiveContainer className="py-8 sm:py-12">{children}</ResponsiveContainer>
      </main>
      <AppFooter />
      <MobileNavigation />
    </div>
  );
}

export { DashboardLayout };
