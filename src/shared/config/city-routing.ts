import type { City } from "@/shared/types/city";

function getCityPath(city: City) {
  return `/${city.slug}`;
}

export { getCityPath };
