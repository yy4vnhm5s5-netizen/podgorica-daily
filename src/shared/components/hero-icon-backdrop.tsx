import {
  CalendarDays,
  Clapperboard,
  CloudSun,
  Droplets,
  Music2,
  Plane,
  TrainFront,
  Waves,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/shared/lib/utils";

interface HeroBackdropIcon {
  className: string;
  icon: LucideIcon;
}

interface HeroIconBackdropProps {
  icons: readonly HeroBackdropIcon[];
}

// Purely decorative icon watermarks for a hero section's page background — never placed behind
// readable content, kept out of the accessibility tree, and inert to pointer input. Each page
// passes its own `icons` motif (see the presets below) so the same primitive can dress different
// heroes with domain-relevant iconography. Hidden below `md:` — at narrow widths there's no
// background margin left for them that wouldn't crowd content. Sizing, opacity, rotation and
// motion all live per-icon in the `className`, not in this base class, so the composition can
// vary icon-to-icon (a single fixed treatment is what read as flat/clustered before).
function HeroIconBackdrop({ icons }: HeroIconBackdropProps) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 hidden overflow-hidden md:block"
    >
      {icons.map(({ className, icon: Icon }, index) => (
        <Icon
          className={cn("absolute stroke-1 text-slate-900 opacity-[0.05]", className)}
          key={index}
        />
      ))}
    </div>
  );
}

// Spans every Gradom domain — used behind the platform homepage's major sections, which aren't
// specific to any one capability. These read as environmental illustrations discovered while
// scrolling, not as a decorative row announcing itself around the hero.
//
// Positioning strategy: each group below is meant to be rendered inside its OWN section's bleed
// wrapper (see platform-homepage.tsx), not one wrapper spanning the whole page. Every icon is
// anchored to that section's own top or bottom edge (`-top-N`/`top-N`/`-bottom-N`/`bottom-N`) —
// never a percentage of a page-wide height. A percentage-of-total-page-height approach was tried
// first and rejected: the denominator (hero + cities grid + how-it-works + FAQ, all together)
// changes independently whenever any one of those grows, shrinks, wraps differently at a
// breakpoint, or gains/loses content (more cities, more/fewer FAQ items) — so an icon meant to
// sit near the FAQ could silently drift into the cities grid after an unrelated content change
// elsewhere on the page. Anchoring each icon to its own section's edge instead means a change in
// one section can only ever move icons that already belong to that section, never any other.
//
// Only the hero's own two icons (the large clipped corner icon and one medium icon) are visible
// without scrolling; the rest belong to later sections and only come into view once scrolled to.
// Left/right, size, opacity and rotation are varied throughout so nothing reads as a mirrored
// pair or a repeating unit. Only 4 of the 9 move, on different keyframes/durations/delays spread
// across sections so nothing drifts in sync and motion isn't bunched at the top either.

// Hero section — the only group visible in the first fold.
const platformHeroSectionIcons: readonly HeroBackdropIcon[] = [
  // Large, partially clipped by the viewport's top-left corner.
  {
    className:
      "-left-16 -top-14 size-[250px] -rotate-6 opacity-[0.07] animate-float-slow [animation-delay:0s]",
    icon: CalendarDays,
  },
  // Medium, upper-right, smaller and lower than the top-left icon — not a mirrored twin.
  {
    className: "-top-6 right-10 size-[150px] rotate-3 opacity-[0.05] animate-float [animation-delay:8s]",
    icon: CloudSun,
  },
];

// Cities section — one near its top edge, one near its bottom edge, opposite sides.
const platformCitiesSectionIcons: readonly HeroBackdropIcon[] = [
  {
    className: "-top-8 left-10 size-[95px] -rotate-3 opacity-[0.04]",
    icon: TrainFront,
  },
  {
    className: "-bottom-8 right-16 size-[115px] rotate-6 opacity-[0.04]",
    icon: Clapperboard,
  },
];

// "How it works" section — short section, so its bleed wrapper extends a bit past its own box
// to give the large Droplets icon room without being tightly clipped.
const platformHowItWorksSectionIcons: readonly HeroBackdropIcon[] = [
  {
    className: "-top-6 left-6 size-[85px] rotate-12 opacity-[0.05]",
    icon: Zap,
  },
  // Large — the second clearly-oversized anchor, reached roughly mid-page.
  {
    className:
      "-bottom-16 -right-12 size-[220px] -rotate-3 opacity-[0.08] animate-float-slower [animation-delay:5s]",
    icon: Droplets,
  },
];

// FAQ section — the last group reached, one near the top and two staggered near the bottom.
const platformFaqSectionIcons: readonly HeroBackdropIcon[] = [
  // Small horizontal + vertical drift for a touch of variety in the motion, not just bobbing.
  {
    className:
      "-top-10 -left-6 size-[140px] rotate-2 opacity-[0.04] animate-drift [animation-delay:2s]",
    icon: Plane,
  },
  {
    className: "-bottom-10 right-24 size-[75px] -rotate-2 opacity-[0.03]",
    icon: Music2,
  },
  // Smallest and faintest — the last thing to surface, near the end of the page content.
  {
    className: "-bottom-4 left-20 size-[80px] rotate-1 opacity-[0.03]",
    icon: Waves,
  },
];

export {
  HeroIconBackdrop,
  platformCitiesSectionIcons,
  platformFaqSectionIcons,
  platformHeroSectionIcons,
  platformHowItWorksSectionIcons,
  type HeroBackdropIcon,
};
