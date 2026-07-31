import type { PropsWithChildren } from "react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { AppFooter } from "@/shared/components/layout/app-footer";
import { AppHeader } from "@/shared/components/layout/app-header";
import { MobileNavigation } from "@/shared/components/layout/mobile-navigation";
import { ResponsiveContainer } from "@/shared/components/layout/responsive-container";
import {
  HeroIconBackdrop,
  cityDashboardBackdropIcons,
} from "@/shared/components/hero-icon-backdrop";
import { PageAtmosphere } from "@/shared/components/page-atmosphere";
import { Button } from "@/shared/components/ui/button";
import type { City } from "@/shared/types/city";
import type { Translations } from "@/shared/lib/translations";

interface DashboardLayoutProps extends PropsWithChildren {
  city: City;
  homeHref?: string;
  translations: Translations;
}

// A single, barely-there identity motif for the page canvas itself: two asymmetric contour-line
// zones — one near the top, one near the footer — with a deliberately empty middle. This is a
// brand signature, not a texture: it must never read as a repeating or tiled pattern, so the two
// zones use different line counts, lengths, and curvature rather than mirrored/evenly-spaced
// copies of each other. It lives on the shared shell (not any individual card), painted before
// every other child so normal DOM paint order puts it behind the header, main content, and footer
// without any z-index bookkeeping. Opaque card/section backgrounds naturally occlude it wherever
// content sits, so it only reads faintly in the page's gutters.
function PageContourMotif() {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full text-slate-900/[0.04]"
      fill="none"
      preserveAspectRatio="xMidYMid slice"
      stroke="currentColor"
      strokeWidth={1}
      viewBox="0 0 800 900"
    >
      {/* Top zone */}
      <path d="M-40 45 C 150 5, 270 95, 470 40 S 770 15, 900 55" />
      <path d="M300 115 C 470 80, 610 150, 900 100" />
      {/* Bottom zone, near the footer — intentionally not a mirror of the top zone */}
      <path d="M-40 815 C 170 770, 310 850, 540 800 S 800 825, 900 785" />
      <path d="M-40 865 C 110 835, 250 885, 470 850" />
    </svg>
  );
}

function DashboardLayout({ children, city, homeHref, translations }: DashboardLayoutProps) {
  const isCityScoped = homeHref === undefined;

  return (
    <div
      className={
        isCityScoped
          ? "relative min-h-screen overflow-hidden bg-[#fbfaf7] pb-[calc(5rem+env(safe-area-inset-bottom))] text-foreground md:pb-0"
          : "relative min-h-screen overflow-hidden bg-background pb-[calc(5rem+env(safe-area-inset-bottom))] text-foreground md:pb-0"
      }
    >
      {isCityScoped ? (
        <>
          <PageAtmosphere variant="city-dashboard" />
          <HeroIconBackdrop icons={cityDashboardBackdropIcons} />
        </>
      ) : (
        <PageContourMotif />
      )}
      <a
        className="absolute left-4 top-4 z-50 -translate-y-20 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-transform focus:translate-y-0"
        href="#main-content"
      >
        {translations.shell.skipToContent}
      </a>
      <AppHeader city={city} homeHref={homeHref} translations={translations} />
      <main id="main-content">
        <ResponsiveContainer className="py-8 sm:py-12">
          {/* Default size, not sm: matches the 44px touch target every other "back" link in the
              app uses (e.g. the event detail page's "back to events" link), rather than the same
              navigational action being a smaller target here than elsewhere. */}
          {isCityScoped ? (
            <Button
              asChild
              className="group mb-6 gap-2 rounded-lg border-brand/25 bg-brand-soft text-brand-foreground hover:border-brand/40 hover:bg-brand/15 focus-visible:ring-brand dark:border-brand/30 dark:bg-brand/10 dark:hover:bg-brand/20"
              variant="outline"
            >
              <Link href="/">
                <ArrowLeft
                  aria-hidden="true"
                  className="size-4 transition-transform duration-200 group-hover:-translate-x-0.5"
                />
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
