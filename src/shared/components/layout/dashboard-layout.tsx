import type { PropsWithChildren } from "react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { AppFooter } from "@/shared/components/layout/app-footer";
import { AppHeader } from "@/shared/components/layout/app-header";
import { MobileNavigation } from "@/shared/components/layout/mobile-navigation";
import { ResponsiveContainer } from "@/shared/components/layout/responsive-container";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";
import type { City } from "@/shared/types/city";
import type { Translations } from "@/shared/lib/translations";

interface DashboardLayoutProps extends PropsWithChildren {
  city: City;
  homeHref?: string;
  translations: Translations;
}

// One shared shell surface for every page. The gradient's starting hue is the only thing that
// varies by city — a restrained identity accent, not a per-city theme — and it always fades back
// to the neutral page background within the first screen.
const cityShellTints: Record<string, string> = {
  budva: "from-[hsl(var(--accent-budva-soft))]",
  podgorica: "from-[hsl(var(--accent-podgorica-soft))]",
};
const defaultCityShellTint = "from-background";

function DashboardLayout({ children, city, homeHref, translations }: DashboardLayoutProps) {
  const isCityScoped = homeHref === undefined;

  return (
    <div
      className={cn(
        "min-h-screen bg-gradient-to-b via-background to-background pb-[calc(5rem+env(safe-area-inset-bottom))] text-foreground md:pb-0",
        cityShellTints[city.id] ?? defaultCityShellTint,
      )}
    >
      <a
        className="absolute left-4 top-4 z-50 -translate-y-20 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-transform focus:translate-y-0"
        href="#main-content"
      >
        {translations.shell.skipToContent}
      </a>
      <AppHeader city={city} homeHref={homeHref} translations={translations} />
      <main id="main-content">
        <ResponsiveContainer className="py-6 sm:py-10">
          {isCityScoped ? (
            <Button asChild className="mb-6 rounded-lg" size="sm" variant="outline">
              <Link href="/">
                <ArrowLeft aria-hidden="true" className="size-4" />
                Povratak na izbor gradova
              </Link>
            </Button>
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
