import {
  ArrowRight,
  Castle,
  CalendarDays,
  CloudSun,
  Film,
  Landmark,
  Music2,
  Plane,
  Ship,
  Umbrella,
  Waves,
  Zap,
} from "lucide-react";
import Link from "next/link";
import type { ComponentType, SVGProps } from "react";

import { CitadelIcon, MarinaSailIcon, MillenniumBridgeIcon } from "@/app/platform-city-icons";
import type {
  CityHighlight,
  CityHighlightVisual,
  PlatformCityCardData,
} from "@/app/platform-homepage-data";
import { cn } from "@/shared/lib/utils";

const highlightIcons = {
  calendar: CalendarDays,
  cloud: CloudSun,
  film: Film,
  music: Music2,
  waves: Waves,
} satisfies Record<CityHighlightVisual, typeof CalendarDays>;

const highlightIconTints = {
  calendar: "text-indigo-600",
  cloud: "text-sky-600",
  film: "text-blue-600",
  music: "text-fuchsia-600",
  waves: "text-teal-600",
} satisfies Record<CityHighlightVisual, string>;

const shortcutIcons = {
  electricity: Zap,
  events: CalendarDays,
  flights: Plane,
  "going-out": Music2,
  "sea-water-quality": Waves,
} as const;

// The icon glyph carries a small semantic tint per capability (matching the same colors used on
// the capability's own dashboard card), while the pill itself stays one neutral shape/background
// — color as a small identity cue on the icon, not as a set of differently-colored backgrounds.
const shortcutIconTints = {
  electricity: "text-amber-600",
  events: "text-indigo-600",
  flights: "text-sky-600",
  "going-out": "text-violet-600",
  "sea-water-quality": "text-cyan-600",
} as const;

const shortcutStyle = "bg-muted text-foreground hover:bg-muted/70";

// Dedicated city identity marks (see platform-city-icons.tsx), per city id. Supports more
// cities later without redesigning the component: unmapped cities fall back to a neutral
// landmark glyph and a neutral tint rather than requiring a code change to render at all.
const cityIdentityIcons: Record<string, ComponentType<SVGProps<SVGSVGElement>>> = {
  bar: Ship,
  budva: CitadelIcon,
  kotor: Castle,
  podgorica: MillenniumBridgeIcon,
  tivat: MarinaSailIcon,
  // Lucide has no literal beach glyph; Umbrella is its parasol form (wide canopy on a planted
  // pole) and is the closest explicit beach mark. Waves is deliberately not reused here — it is
  // already the sea-water-quality capability icon in this same file.
  ulcinj: Umbrella,
};

// Restrained per-city identity accents (see globals.css) — a subtle surface tint, not a theme.
const cityIdentityStyles: Record<string, string> = {
  budva: "bg-[hsl(var(--accent-budva-soft))] text-[hsl(var(--accent-budva))]",
  kotor: "bg-slate-100 text-slate-700",
  podgorica: "bg-[hsl(var(--accent-podgorica-soft))] text-[hsl(var(--accent-podgorica))]",
  tivat: "bg-[hsl(var(--accent-tivat-soft))] text-[hsl(var(--accent-tivat))]",
};

const defaultCityIdentityStyle = "bg-slate-100 text-slate-700";

function CityIdentityIcon({ cityId, size = "md" }: { cityId: string; size?: "md" | "sm" }) {
  const Icon = cityIdentityIcons[cityId] ?? Landmark;
  const style = cityIdentityStyles[cityId] ?? defaultCityIdentityStyle;

  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-xl",
        size === "sm" ? "size-7" : "size-10",
        style,
      )}
    >
      <Icon className={size === "sm" ? "size-4" : "size-5"} strokeWidth={1.8} />
    </span>
  );
}

function CityCard({ card }: { card: PlatformCityCardData }) {
  const headingId = `platform-city-heading-${card.city.id}`;

  return (
    <article
      aria-labelledby={headingId}
      // This is the homepage's one "featured/selected" card, so it keeps a single distinguishing
      // signal — a slightly more present shadow that lifts further on hover — instead of the
      // gradient wash + colored border + double shadow jump it used to stack. Color still lives
      // on the identity icon and the primary CTA; the card surface itself stays neutral.
      className="group relative overflow-hidden rounded-2xl border border-border bg-background shadow-sm shadow-slate-950/[0.05] transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-md hover:shadow-slate-950/[0.08]"
    >
      <Link
        aria-label={`Otvori grad ${card.city.name}`}
        className="absolute inset-0 z-20 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
        href={card.href}
      />
      <div className="pointer-events-none relative z-10 space-y-5 p-6 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <CityIdentityIcon cityId={card.city.id} />
            <div className="space-y-1">
              <h3
                className="font-display text-xl font-semibold leading-snug tracking-normal text-slate-950 sm:text-2xl"
                id={headingId}
              >
                {card.city.name}
              </h3>
              <p className="max-w-sm text-sm leading-5 text-muted-foreground">
                {card.city.description ?? `Lokalne informacije za grad ${card.city.name}.`}
              </p>
            </div>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-orange-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors group-hover:bg-orange-800">
            Otvori grad
            <ArrowRight
              aria-hidden="true"
              className="size-4 transition-transform group-hover:translate-x-0.5"
            />
          </span>
        </div>
        {card.highlights.length > 0 ? (
          <div className="grid grid-cols-2 divide-x divide-y divide-border overflow-hidden rounded-xl border border-border bg-muted/40 sm:grid-cols-4 sm:divide-y-0">
            {card.highlights.map((highlight) => (
              <MetricTile highlight={highlight} key={highlight.key} />
            ))}
          </div>
        ) : null}
        {card.shortcuts.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            {card.shortcuts.map((shortcut) => (
              <CityShortcut key={shortcut.key} shortcut={shortcut} />
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
}

function MetricTile({ highlight }: { highlight: CityHighlight }) {
  const Icon = highlightIcons[highlight.visual];
  const content = (
    <>
      <Icon
        aria-hidden="true"
        className={`size-4 shrink-0 ${highlightIconTints[highlight.visual]}`}
      />
      <span className="min-w-0">
        <span
          className={
            highlight.state === "unavailable"
              ? "block text-sm font-semibold leading-5 text-muted-foreground"
              : "block truncate text-2xl font-light leading-tight tracking-tight text-foreground sm:text-3xl"
          }
        >
          {highlight.value}
        </span>
        {highlight.label ? (
          <span className="block text-xs font-normal text-muted-foreground">{highlight.label}</span>
        ) : null}
      </span>
    </>
  );
  const rowClassName = "flex min-h-[3.75rem] min-w-0 items-center gap-2 px-3 py-2.5";

  return highlight.href ? (
    <Link
      aria-label={highlight.accessibilityLabel}
      className={`${rowClassName} pointer-events-auto transition-colors hover:bg-background focus-visible:relative focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary`}
      href={highlight.href}
    >
      {content}
    </Link>
  ) : (
    <div className={rowClassName}>{content}</div>
  );
}

function CityShortcut({ shortcut }: { shortcut: PlatformCityCardData["shortcuts"][number] }) {
  const key = shortcut.key as keyof typeof shortcutIcons;
  const Icon = shortcutIcons[key];

  return (
    <Link
      className={`pointer-events-auto inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors focus-visible:relative focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${shortcutStyle}`}
      href={shortcut.href}
    >
      <Icon aria-hidden="true" className={`size-3.5 ${shortcutIconTints[key]}`} />
      {shortcut.label}
    </Link>
  );
}

export { CityCard, CityIdentityIcon };
