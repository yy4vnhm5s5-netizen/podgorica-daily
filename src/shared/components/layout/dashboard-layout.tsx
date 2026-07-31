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
  tivat: "from-[hsl(var(--accent-tivat-soft))]",
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

// City-page-only atmosphere, composed as two depth planes rather than one flat set of gradients —
// this is what actually reads as a "landscape" instead of a wash: a soft, broad background plane
// (lighter, larger, lower saturation — the "sky") sets the bright reading area and the airy upper
// canvas, while a foreground plane of more saturated, tighter-falloff masses ("hills") sits on top
// of it with a crisper transition to transparent, so it visually sits in front of the background
// plane rather than blending flush into it. Both planes still use flat color plateaus before
// fading (never fading from the very center) so every mass has a genuinely readable core. Positions
// and aspect ratios are deliberately irregular and asymmetric across both planes — different radii,
// different corners/edges, nothing mirrored — so the result reads as one organic composition, not a
// repeated motif. This root shell div isn't nested inside the padded ResponsiveContainer (that only
// wraps `main`), so `inset-0` here already spans the true page width — no full-bleed breakout trick
// is needed, unlike the homepage's atmosphere. A mask fades the whole thing out by the lower half of
// the band so it resolves into the plain shell background before scrolling far. Independent of, and
// unrelated to, the shared PlatformAtmosphere used by the homepage/contact page — no code or
// values shared.
function CityAtmosphere() {
  const maskImage = "linear-gradient(to bottom, black 0%, black 50%, transparent 85%)";

  // Background plane: broad, soft, lower-saturation — sets the bright reading area and the airy
  // sky behind the foreground hills. The main glow is offset left-of-center (44%, not 50%) and
  // very wide/shallow so it reads as a horizon, not a bright vertical corridor down the middle;
  // the upper-left corner (behind the logo/nav) is deliberately the calmest, lowest-alpha spot.
  const sky = [
    "radial-gradient(130% 45% at 44% -8%, hsl(200 55% 93% / 0.28) 0%, transparent 78%)",
    "radial-gradient(70% 50% at 4% -2%, hsl(198 45% 90% / 0.16) 0%, transparent 72%)",
    "radial-gradient(70% 55% at 100% 4%, hsl(214 50% 86% / 0.2) 0%, transparent 72%)",
  ].join(", ");

  // Foreground plane: repositioned so nothing sits in a plain corner-glow arrangement — cyan
  // rises diagonally from the lower-left instead of pooling in the top-left corner, blue sweeps
  // across the upper-middle instead of sitting in the top-right, and indigo is pushed to a
  // narrow, vertical band at the far-right edge instead of a broad top-right mass. A soft diagonal
  // linear "bridge" ties the lower-left to the upper-right, and a small off-axis accent keeps the
  // composition asymmetric rather than a mirrored two-corner layout.
  const hills = [
    "radial-gradient(62% 100% at -2% 66%, hsl(190 78% 72% / 0.5) 0%, hsl(190 78% 72% / 0.5) 30%, transparent 68%)",
    "radial-gradient(115% 48% at 42% 2%, hsl(210 70% 70% / 0.42) 0%, hsl(210 70% 70% / 0.42) 28%, transparent 66%)",
    "radial-gradient(30% 100% at 104% 50%, hsl(234 55% 64% / 0.4) 0%, hsl(234 55% 64% / 0.4) 26%, transparent 65%)",
    "radial-gradient(38% 34% at 82% 92%, hsl(242 42% 62% / 0.28) 0%, hsl(242 42% 62% / 0.28) 24%, transparent 64%)",
    "linear-gradient(52deg, transparent 12%, hsl(205 60% 88% / 0.22) 45%, transparent 76%)",
  ].join(", ");

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 h-[46rem] overflow-hidden sm:h-[40rem]"
      style={{ WebkitMaskImage: maskImage, maskImage }}
    >
      <div className="absolute inset-0" style={{ backgroundImage: sky }} />
      <div className="absolute inset-0" style={{ backgroundImage: hills }} />
    </div>
  );
}

function DashboardLayout({ children, city, homeHref, translations }: DashboardLayoutProps) {
  const isCityScoped = homeHref === undefined;
  // The platform homepage and contact page each render their own shared PlatformAtmosphere layer
  // (src/app/platform-atmosphere.tsx), which should be the one source of background depth there —
  // stacking the shell's own per-city tint underneath it reads as two competing blue background
  // systems. City-scoped dashboard pages have no such atmosphere layer, so they keep their
  // existing subtle identity tint unchanged.
  const shellTint = isCityScoped ? (cityShellTints[city.id] ?? defaultCityShellTint) : defaultCityShellTint;

  return (
    <div
      className={cn(
        "relative min-h-screen overflow-hidden bg-gradient-to-b via-background to-background pb-[calc(5rem+env(safe-area-inset-bottom))] text-foreground md:pb-0",
        shellTint,
      )}
    >
      {isCityScoped ? <CityAtmosphere /> : <PageContourMotif />}
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
            <Button asChild className="mb-6 gap-2 rounded-lg" variant="outline">
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
