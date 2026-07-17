import type { Locale } from "@/shared/config/locale";

type CityId = "bar" | "niksic" | "podgorica";

interface City {
  country: string;
  displayName: string;
  enabled: boolean;
  id: CityId;
  latitude: number;
  longitude: number;
  slug: string;
  timezone: string;
}

interface CityContext {
  city: City;
  locale: Locale;
  timezone: string;
}

export { type City, type CityContext, type CityId };
