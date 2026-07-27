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

// A single, barely-there identity motif for the page canvas itself: contour-map lines, evoking
// "this is about places" without literal landmarks or added color. It lives on the shared shell
// (not any individual card), painted before every other child so normal DOM paint order puts it
// behind the header, main content, and footer without any z-index bookkeeping. Opaque card/section
// backgrounds naturally occlude it wherever content sits, so it only reads in the page's gutters.
function PageContourMotif() {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full text-slate-900/[0.05]"
      fill="none"
      preserveAspectRatio="xMidYMid slice"
      stroke="currentColor"
      strokeWidth={1}
      viewBox="0 0 800 900"
    >
      <path d="M-40 80 C 120 30, 220 130, 360 70 S 620 110, 860 50" />
      <path d="M-40 150 C 140 90, 240 190, 380 130 S 640 170, 860 110" />
      <path d="M-40 220 C 160 150, 260 250, 400 190 S 660 230, 860 170" />
      <path d="M-40 610 C 140 560, 240 660, 380 600 S 640 640, 860 580" />
      <path d="M-40 680 C 160 620, 260 720, 400 660 S 660 700, 860 640" />
      <path d="M-40 750 C 180 690, 280 790, 420 730 S 680 770, 860 710" />
    </svg>
  );
}

function DashboardLayout({ children, city, homeHref, translations }: DashboardLayoutProps) {
  const isCityScoped = homeHref === undefined;

  return (
    <div
      className={cn(
        "relative min-h-screen overflow-hidden bg-gradient-to-b via-background to-background pb-[calc(5rem+env(safe-area-inset-bottom))] text-foreground md:pb-0",
        cityShellTints[city.id] ?? defaultCityShellTint,
      )}
    >
      <PageContourMotif />
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
