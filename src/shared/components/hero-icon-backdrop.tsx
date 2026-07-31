import {
  CalendarDays,
  Clapperboard,
  CloudSun,
  Droplets,
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

// Purely decorative, edge-anchored icon watermarks for a hero section — never placed behind the
// readable content column, kept out of the accessibility tree, and inert to pointer input. Each
// page passes its own `icons` motif (see the presets below) so the same primitive can dress
// different heroes with domain-relevant iconography instead of one fixed illustration. Hidden
// below `md:` — at narrow widths there's no edge margin left for them that wouldn't crowd text.
function HeroIconBackdrop({ icons }: HeroIconBackdropProps) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 hidden overflow-hidden md:block"
    >
      {icons.map(({ className, icon: Icon }, index) => (
        <Icon
          className={cn("absolute stroke-1 text-slate-900 opacity-[0.06]", className)}
          key={index}
        />
      ))}
    </div>
  );
}

// Spans every Gradom domain — used on the platform homepage hero, which isn't specific to any
// one capability. Every icon is anchored to a corner/edge with a negative offset so it bleeds
// past the card boundary (clipped by the parent's overflow-hidden) rather than floating over the
// middle of the card, where the headline and CTAs sit. Positions, sizes and animation timing are
// deliberately irregular — mixed corners, mixed sizes — so the effect reads as ambient, not tiled.
// Motion is intentionally rare: most icons are static, and the two that move use different,
// very slow, out-of-phase durations so nothing moves in sync or competes with the headline.
const platformHeroIcons: readonly HeroBackdropIcon[] = [
  {
    className: "-left-8 -top-10 size-32 -rotate-6",
    icon: CalendarDays,
  },
  {
    className: "-right-8 -top-14 size-40 rotate-6 animate-float-slow",
    icon: CloudSun,
  },
  {
    className: "-left-10 -bottom-12 size-28 rotate-3",
    icon: Droplets,
  },
  {
    className: "-right-10 -bottom-16 size-36 -rotate-3",
    icon: Zap,
  },
  {
    className:
      "-right-6 top-1/2 size-24 -translate-y-1/2 rotate-6 animate-float-slower [animation-delay:4s]",
    icon: Waves,
  },
  {
    className: "-left-6 -bottom-4 size-20 -rotate-6",
    icon: Clapperboard,
  },
];

export { HeroIconBackdrop, platformHeroIcons, type HeroBackdropIcon };
