import Link from "next/link";

import { CityIdentityIcon } from "@/app/platform-city-panel";
import { getActiveCities } from "@/shared/config/cities";
import { getCityPath } from "@/shared/config/public-routes";

// Registry-driven, so a seventh city appears here with no edit. Deliberately lighter than the
// homepage selector: a national utility page needs a way into the city hubs, not a second copy of
// the homepage's per-city dashboard data (which would load every provider snapshot to render).
function PlatformCityDiscovery() {
  const cities = getActiveCities();
  if (cities.length === 0) return null;

  return (
    <section aria-labelledby="gradovi-heading" className="space-y-3 border-t border-border pt-8">
      <h2 className="text-lg font-semibold tracking-tight" id="gradovi-heading">
        Informacije iz gradova
      </h2>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {cities.map((city) => (
          <li key={city.id}>
            <Link
              className="focus-visible:ring-ring flex items-center gap-3 rounded-xl border border-border p-3 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2"
              href={getCityPath(city)}
            >
              <CityIdentityIcon cityId={city.id} size="sm" />
              <span className="min-w-0">
                <span className="block text-sm font-medium">{city.name}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export { PlatformCityDiscovery };
