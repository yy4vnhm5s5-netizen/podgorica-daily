import { ArrowUpRight, CalendarDays, Music2, Waves, Zap, type LucideIcon } from "lucide-react";
import Link from "next/link";

import {
  getFlightsCityDiscovery,
  getFlightsCityDiscoveryDesktopColumns,
  type FlightsCityDiscoveryKey,
} from "./flights-city-discovery-model";
import { cn } from "@/shared/lib/utils";
import type { City } from "@/shared/types/city";

interface FlightsCityDiscoveryProps {
  city: City;
}

const discoveryIcons = {
  electricity: Zap,
  events: CalendarDays,
  goingOut: Music2,
  seaWaterQuality: Waves,
} satisfies Record<FlightsCityDiscoveryKey, LucideIcon>;

const discoveryStyles = {
  electricity: {
    icon: "bg-amber-600 text-white",
    tile: "border-amber-200 bg-amber-50 text-amber-950 hover:border-amber-300 hover:bg-amber-100",
  },
  events: {
    icon: "bg-indigo-600 text-white",
    tile: "border-indigo-200 bg-indigo-50 text-indigo-950 hover:border-indigo-300 hover:bg-indigo-100",
  },
  goingOut: {
    icon: "bg-violet-600 text-white",
    tile: "border-violet-200 bg-violet-50 text-violet-950 hover:border-violet-300 hover:bg-violet-100",
  },
  seaWaterQuality: {
    icon: "bg-cyan-600 text-white",
    tile: "border-cyan-200 bg-cyan-50 text-cyan-950 hover:border-cyan-300 hover:bg-cyan-100",
  },
} satisfies Record<FlightsCityDiscoveryKey, { icon: string; tile: string }>;

function FlightsCityDiscovery({ city }: FlightsCityDiscoveryProps) {
  const discovery = getFlightsCityDiscovery(city);
  if (discovery.links.length === 0) return null;
  const desktopColumns = getFlightsCityDiscoveryDesktopColumns(discovery.links.length);

  return (
    <nav
      aria-labelledby="flights-city-discovery-heading"
      className="overflow-hidden rounded-2xl border border-sky-200/80 bg-gradient-to-br from-sky-50 via-violet-50/70 to-cyan-50 p-4 shadow-sm shadow-sky-950/[0.04] sm:p-5"
    >
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Nastavite istraživanje
          </p>
          <h2
            className="mt-1 text-lg font-semibold tracking-tight"
            id="flights-city-discovery-heading"
          >
            {discovery.heading}
          </h2>
        </div>
      </div>
      <ul className={cn("mt-4 grid grid-cols-2 gap-3", desktopColumns)}>
        {discovery.links.map((link) => {
          const Icon = discoveryIcons[link.key];
          const style = discoveryStyles[link.key];

          return (
            <li key={link.key}>
              <Link
                aria-label={link.navigationLabel}
                className={cn(
                  "group flex min-h-28 flex-col justify-between rounded-xl border p-3 text-left shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                  style.tile,
                )}
                href={link.href}
              >
                <span className="flex items-start justify-between gap-3">
                  <span
                    aria-hidden="true"
                    className={cn(
                      "flex size-8 items-center justify-center rounded-lg shadow-sm",
                      style.icon,
                    )}
                  >
                    <Icon className="size-4" strokeWidth={2} />
                  </span>
                  <ArrowUpRight aria-hidden="true" className="size-4 opacity-70" strokeWidth={2} />
                </span>
                <span className="mt-3 block">
                  <span className="block text-sm font-semibold leading-5">{link.label}</span>
                  <span className="mt-0.5 block text-xs leading-4 opacity-75">
                    {link.description}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export { FlightsCityDiscovery, type FlightsCityDiscoveryProps };
