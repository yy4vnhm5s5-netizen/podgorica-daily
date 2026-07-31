import {
  CalendarDays,
  Building2,
  Clapperboard,
  CloudSun,
  Droplets,
  FileText,
  HeartPulse,
  MapPin,
  Music2,
  Plane,
  Ticket,
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

// Full-viewport bleed wrapper shared by the homepage hero and city dashboards. It preserves the
// same clipping, stacking and viewport-relative positioning for every shared icon preset.
function DecorativeIconBleed({ icons }: HeroIconBackdropProps) {
  return (
    <div className="pointer-events-none absolute -bottom-16 -top-16 left-1/2 w-screen -translate-x-1/2 overflow-hidden">
      <HeroIconBackdrop icons={icons} />
    </div>
  );
}

// Spans every Gradom domain — used behind the platform homepage's major sections, which aren't
// specific to any one capability. These read as environmental illustrations discovered while
// scrolling, not as a decorative row announcing itself around the hero. One icon per requested
// motif (weather, calendar, events, cinema, water, sea, electricity, railway, flights, music,
// location) — 11 total, no two from the same domain sit in the same section.
//
// Visibility mix: most icons use a POSITIVE top/bottom offset, meaning they sit fully inside
// their section's bleed area near its edge with no clipping at all. Only three use a NEGATIVE
// offset that intentionally bleeds past the section's edge: CalendarDays and Droplets (the two
// oversized "anchor" icons) and Clapperboard (a smaller partial clip on one edge only, for
// texture). That keeps clipping rare and modest (roughly 15–25% of the icon's own footprint on
// the icons that have it at all) rather than the every-icon-touches-an-edge treatment used
// before, which read as over-clipped.
//
// Positioning strategy (unchanged from the previous pass): each group is rendered inside its OWN
// section's bleed wrapper (see platform-homepage.tsx), not one wrapper spanning the whole page.
// Every offset is anchored to that section's own top or bottom edge — never a percentage of
// page-wide height — so a content change in one section can only ever move icons that already
// belong to it.
//
// Only the hero's own two icons are visible without scrolling; the rest belong to later sections
// and only come into view once scrolled to. Size, opacity (mixed across 3%/5%/7%/9%) and rotation
// are varied throughout so nothing reads as a mirrored pair or a repeating unit. Only 4 of the 11
// move — unchanged from the previous pass, same keyframes/durations/delays — motion was not
// increased this round.

// Hero section — the only group visible in the first fold. Unchanged from the previous pass.
const platformHeroSectionIcons: readonly HeroBackdropIcon[] = [
  // Very large, intentionally clipped by the viewport's top-left corner (~22–25% of its own
  // footprint) — the strongest anchor of the whole composition.
  {
    className:
      "-left-16 -top-14 size-[250px] -rotate-6 opacity-[0.07] animate-float-slow [animation-delay:0s]",
    icon: CalendarDays,
  },
  // Medium, upper-right, fully visible — inset from the edge, not bleeding past it.
  {
    className:
      "top-8 right-10 size-[160px] rotate-3 opacity-[0.05] animate-float [animation-delay:8s]",
    icon: CloudSun,
  },
];

// Cities section — three icons, alternating sides, all but one fully visible.
const platformCitiesSectionIcons: readonly HeroBackdropIcon[] = [
  {
    className: "top-10 left-10 size-[100px] -rotate-3 opacity-[0.03]",
    icon: TrainFront,
  },
  // Partial clip on the right edge only (top/bottom stay fully visible) — a lighter touch than
  // the two large anchor icons.
  {
    className: "bottom-12 -right-6 size-[130px] rotate-6 opacity-[0.05]",
    icon: Clapperboard,
  },
  {
    className: "bottom-16 left-20 size-[75px] -rotate-2 opacity-[0.03]",
    icon: MapPin,
  },
];

// "How it works" section — short section, so its bleed wrapper extends a bit past its own box
// to give the large Droplets icon room without being tightly clipped.
const platformHowItWorksSectionIcons: readonly HeroBackdropIcon[] = [
  {
    className: "top-10 left-8 size-[90px] rotate-12 opacity-[0.05]",
    icon: Zap,
  },
  // Very large — the second clearly-oversized anchor, reached roughly mid-page, intentionally
  // clipped (~22–29% of its own footprint) to match the hero's own anchor icon.
  {
    className:
      "-bottom-16 -right-12 size-[220px] -rotate-3 opacity-[0.09] animate-float-slower [animation-delay:5s]",
    icon: Droplets,
  },
  {
    className: "bottom-10 right-10 size-[80px] rotate-2 opacity-[0.03]",
    icon: Ticket,
  },
];

// FAQ section — the last group reached, all fully visible.
const platformFaqSectionIcons: readonly HeroBackdropIcon[] = [
  // Small horizontal + vertical drift for a touch of variety in the motion, not just bobbing —
  // unchanged from the previous pass.
  {
    className:
      "top-10 left-10 size-[150px] rotate-2 opacity-[0.05] animate-drift [animation-delay:2s]",
    icon: Plane,
  },
  {
    className: "bottom-12 right-24 size-[75px] -rotate-2 opacity-[0.03]",
    icon: Music2,
  },
  {
    className: "bottom-8 left-16 size-[120px] rotate-1 opacity-[0.05]",
    icon: Waves,
  },
];

// City dashboards use the same backdrop primitive as the platform homepage, but distribute the
// city-relevant motifs across the full dashboard height. The 2.5–3% opacity keeps them strictly
// atmospheric while each section's translucent surface naturally softens them further.
const cityDashboardPageIcons: readonly HeroBackdropIcon[] = [
  { className: "-left-10 top-[6%] size-[150px] -rotate-6 opacity-[0.03]", icon: CalendarDays },
  { className: "right-8 top-[14%] size-[112px] rotate-3 opacity-[0.025]", icon: Building2 },
  { className: "-right-10 top-[28%] size-[156px] rotate-6 opacity-[0.03]", icon: MapPin },
  { className: "left-8 top-[41%] size-[104px] -rotate-3 opacity-[0.025]", icon: FileText },
  { className: "right-10 top-[55%] size-[128px] rotate-2 opacity-[0.03]", icon: Music2 },
  { className: "-left-10 top-[69%] size-[154px] -rotate-6 opacity-[0.025]", icon: HeartPulse },
  { className: "right-10 top-[82%] size-[112px] rotate-3 opacity-[0.03]", icon: TrainFront },
  { className: "-left-8 top-[92%] size-[124px] -rotate-3 opacity-[0.025]", icon: Waves },
  { className: "right-8 top-[96%] size-[92px] rotate-6 opacity-[0.025]", icon: Clapperboard },
];

export {
  DecorativeIconBleed,
  HeroIconBackdrop,
  cityDashboardPageIcons,
  platformCitiesSectionIcons,
  platformFaqSectionIcons,
  platformHeroSectionIcons,
  platformHowItWorksSectionIcons,
  type HeroBackdropIcon,
};
