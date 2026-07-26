import type { Locale } from "@/shared/config/locale";

type CityId = string;
type CityNameForm = "accusative" | "locative" | "nominative";

type CityCapability =
  "electricity" | "events" | "flights" | "goingOut" | "railway" | "water" | "weather";

interface City {
  accusativeName?: string;
  capabilities?: readonly CityCapability[];
  country: string;
  description?: string;
  id: CityId;
  isActive: boolean;
  isMain: boolean;
  latitude: number;
  longitude: number;
  locativeName?: string;
  name: string;
  slug: string;
  timezone: string;
}

interface CityContext {
  city: City;
  locale: Locale;
  timezone: string;
}

export { type City, type CityCapability, type CityContext, type CityId, type CityNameForm };
