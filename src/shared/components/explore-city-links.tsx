import Link from "next/link";

import { getCityName } from "@/shared/config/cities";
import {
  getExploreCityLinks,
  type ExploreCityLinkKey,
  type ExploreCityLinksOptions,
} from "@/shared/config/explore-city-links";
import { cn } from "@/shared/lib/utils";
import type { City } from "@/shared/types/city";

interface ExploreCityLinksProps extends Pick<ExploreCityLinksOptions, "exclude" | "limit"> {
  city: City;
  className?: string;
  /** Overrides the generated `Istražite još u <grad>` heading. */
  heading?: string;
  headingId?: string;
}

// Contextual same-city navigation for feature and detail pages: a compact block of crawlable
// links to the other things this city offers. Destinations are derived from the city registry's
// capabilities (see getExploreCityLinks), so the same component can be dropped onto any city
// feature page without that page knowing which cities support what. Renders nothing when a city
// has no other destination to offer, so it never leaves an empty box behind.
function ExploreCityLinks({
  city,
  className,
  exclude,
  heading,
  headingId = "explore-city-links-heading",
  limit,
}: ExploreCityLinksProps) {
  const links = getExploreCityLinks(city, { exclude, limit });
  if (links.length === 0) return null;

  return (
    <nav
      aria-labelledby={headingId}
      className={cn("rounded-xl border border-border bg-muted/30 p-4 sm:p-5", className)}
    >
      <h2 className="text-sm font-semibold tracking-tight" id={headingId}>
        {heading ?? `Istražite još u ${getCityName(city, "locative")}`}
      </h2>
      <ul className="mt-3 flex flex-wrap gap-2">
        {links.map((link) => (
          <li key={link.key}>
            <Link
              className="inline-flex min-h-10 items-center rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              href={link.href}
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export { ExploreCityLinks, type ExploreCityLinksProps, type ExploreCityLinkKey };
