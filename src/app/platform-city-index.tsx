import Link from "next/link";

import { CityIdentityIcon } from "@/app/platform-city-panel";
import { getActiveCities } from "@/shared/config/cities";
import { getCityPath } from "@/shared/config/public-routes";

// The tab strip above already carries every city's name and a real link to it, but only the one
// selected city ever states what Gradom actually covers there. This list gives each city its own
// sentence — the registry's own description, nothing written for search engines — so a reader
// scanning the page (and a crawler reading the initial HTML) can tell Ulcinj from Kotor without
// clicking through six tabs. Registry-driven: a seventh city appears here with no edit, and an
// inactive one never does.
//
// Deliberately not a second set of dashboard cards: no live data, no metrics, no per-city cache
// read. It costs one config lookup.
function PlatformCityIndex() {
  const cities = getActiveCities();
  if (cities.length === 0) return null;

  return (
    <nav aria-labelledby="all-cities-heading" className="rounded-xl border border-border/70 p-4">
      <h3
        className="text-xs font-semibold uppercase tracking-widest text-muted-foreground"
        id="all-cities-heading"
      >
        Svi gradovi
      </h3>
      <ul className="mt-3 grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
        {cities.map((city) => (
          <li key={city.id}>
            <Link
              className="focus-visible:ring-ring group flex items-start gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2"
              href={getCityPath(city)}
            >
              <CityIdentityIcon cityId={city.id} size="sm" />
              <span className="min-w-0">
                <span className="text-sm font-semibold text-foreground group-hover:underline">
                  {city.name}
                </span>
                {city.description ? (
                  <span className="block text-xs leading-5 text-muted-foreground">
                    {city.description}
                  </span>
                ) : null}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export { PlatformCityIndex };
