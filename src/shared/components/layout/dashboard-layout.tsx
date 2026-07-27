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
  // The platform homepage carries its own hero atmosphere layer (see HomepageAtmosphere), which
  // should be the one source of background depth there — stacking the shell's own per-city tint
  // underneath it reads as two competing blue background systems. City-scoped dashboard pages
  // have no such atmosphere layer, so they keep their existing subtle identity tint unchanged.
  const shellTint = isCityScoped ? (cityShellTints[city.id] ?? defaultCityShellTint) : defaultCityShellTint;

  return (
    <div
      className={cn(
        "relative min-h-screen overflow-hidden bg-gradient-to-b via-background to-background pb-[calc(5rem+env(safe-area-inset-bottom))] text-foreground md:pb-0",
        shellTint,
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
