import { getCityName } from "@/shared/config/cities";
import { getExploreCityLinks, type ExploreCityLinkKey } from "@/shared/config/explore-city-links";
import type { CityRouteAvailabilityOptions } from "@/shared/config/city-routes";
import type { City } from "@/shared/types/city";

type CityFeatureDiscoveryKey = Exclude<ExploreCityLinkKey, "city">;

interface CityFeatureDiscoveryLink {
  description: string;
  href: string;
  key: CityFeatureDiscoveryKey;
  label: string;
  navigationLabel: string;
}

interface CityFeatureDiscovery {
  heading: string;
  links: readonly CityFeatureDiscoveryLink[];
}

// This is presentation copy, not a second city-feature matrix. The shared ExploreCityLinks model
// owns route selection, capability checks, public-feature availability and deterministic order.
const discoveryCopy: Record<
  CityFeatureDiscoveryKey,
  Pick<CityFeatureDiscoveryLink, "description" | "label">
> = {
  electricity: { description: "Servisne informacije", label: "Struja" },
  events: { description: "Događaji i najave", label: "Događaji" },
  flights: { description: "Dolasci i odlasci", label: "Letovi" },
  goingOut: { description: "Izlasci i nastupi", label: "Izlasci" },
  parking: { description: "Slobodna mjesta", label: "Parking" },
  seaWaterQuality: { description: "Kvalitet mora", label: "Plaže" },
};

function getCityFeatureDiscovery(
  city: City,
  currentFeature: CityFeatureDiscoveryKey,
  availability: CityRouteAvailabilityOptions = {},
): CityFeatureDiscovery {
  const links = getExploreCityLinks(city, {
    ...availability,
    exclude: ["city", currentFeature],
    limit: 4,
  }).flatMap((link): CityFeatureDiscoveryLink[] => {
    if (link.key === "city" || link.key === currentFeature) return [];

    const copy = discoveryCopy[link.key];
    return [
      {
        ...copy,
        href: link.href,
        key: link.key,
        navigationLabel: link.label,
      },
    ];
  });

  return {
    heading: `Još iz ${getCityName(city, "genitive")}`,
    links,
  };
}

function getCityFeatureDiscoveryDesktopColumns(linkCount: number) {
  if (linkCount <= 1) return "lg:grid-cols-1";
  if (linkCount === 2) return "lg:grid-cols-2";
  if (linkCount === 3) return "lg:grid-cols-3";
  return "lg:grid-cols-4";
}

export {
  getCityFeatureDiscoveryDesktopColumns,
  getCityFeatureDiscovery,
  type CityFeatureDiscovery,
  type CityFeatureDiscoveryKey,
  type CityFeatureDiscoveryLink,
};
