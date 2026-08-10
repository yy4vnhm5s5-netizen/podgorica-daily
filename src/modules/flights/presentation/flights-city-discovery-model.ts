import { getCityName } from "@/shared/config/cities";
import { getExploreCityLinks, type ExploreCityLinkKey } from "@/shared/config/explore-city-links";
import type { CityRouteAvailabilityOptions } from "@/shared/config/city-routes";
import type { City } from "@/shared/types/city";

type FlightsCityDiscoveryKey = Exclude<ExploreCityLinkKey, "city" | "flights">;

interface FlightsCityDiscoveryLink {
  description: string;
  href: string;
  key: FlightsCityDiscoveryKey;
  label: string;
  navigationLabel: string;
}

interface FlightsCityDiscovery {
  heading: string;
  links: readonly FlightsCityDiscoveryLink[];
}

// This is presentation copy, not a second city-feature matrix. The shared ExploreCityLinks model
// owns route selection, capability checks, public-feature availability and deterministic order.
const discoveryCopy: Record<
  FlightsCityDiscoveryKey,
  Pick<FlightsCityDiscoveryLink, "description" | "label">
> = {
  electricity: { description: "Servisne informacije", label: "Struja" },
  events: { description: "Događaji i najave", label: "Događaji" },
  goingOut: { description: "Izlasci i nastupi", label: "Izlasci" },
  seaWaterQuality: { description: "Kvalitet mora", label: "Plaže" },
};

function getFlightsCityDiscovery(
  city: City,
  availability: CityRouteAvailabilityOptions = {},
): FlightsCityDiscovery {
  const links = getExploreCityLinks(city, {
    ...availability,
    exclude: ["flights", "city"],
    limit: 4,
  }).flatMap((link): FlightsCityDiscoveryLink[] => {
    if (link.key === "city" || link.key === "flights") return [];

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

export {
  getFlightsCityDiscovery,
  type FlightsCityDiscovery,
  type FlightsCityDiscoveryKey,
  type FlightsCityDiscoveryLink,
};
