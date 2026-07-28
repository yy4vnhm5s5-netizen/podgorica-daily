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
// unrelated to, the homepage's HomepageAtmosphere — no code or values shared.
function CityAtmosphere() {
  const maskImage = "linear-gradient(to bottom, black 0%, black 50%, transparent 85%)";

  // Background plane: broad, soft, lower-saturation — sets the bright central reading area and
  // the overall airy sky behind the foreground hills.
  const sky = [
    "radial-gradient(100% 65% at 50% -12%, hsl(200 55% 93% / 0.32) 0%, transparent 76%)",
    "radial-gradient(85% 62% at 6% -4%, hsl(196 62% 84% / 0.3) 0%, transparent 74%)",
    "radial-gradient(80% 68% at 102% 8%, hsl(214 60% 84% / 0.28) 0%, transparent 74%)",
  ].join(", ");

  // Foreground plane: fewer, more saturated masses with a tighter fade — these read as sitting
  // in front of the sky plane, giving the composition depth instead of one flat blend.
  const hills = [
    "radial-gradient(68% 55% at 0% 42%, hsl(190 80% 72% / 0.55) 0%, hsl(190 80% 72% / 0.55) 34%, transparent 68%)",
    "radial-gradient(64% 58% at 100% 46%, hsl(231 58% 66% / 0.46) 0%, hsl(231 58% 66% / 0.46) 32%, transparent 66%)",
    "radial-gradient(58% 48% at 28% 96%, hsl(210 72% 70% / 0.4) 0%, hsl(210 72% 70% / 0.4) 30%, transparent 68%)",
    "radial-gradient(42% 38% at 94% 90%, hsl(240 46% 64% / 0.32) 0%, hsl(240 46% 64% / 0.32) 26%, transparent 65%)",
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
      {isCityScoped ? <CityAtmosphere /> : <PageContourMotif />}
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
